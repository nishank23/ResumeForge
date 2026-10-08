import { parentPort, workerData } from "node:worker_threads";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import { pdfPageText } from "./pdf-text.js";

const MAX_TEXT = 500_000;
function checkDocx(buffer: Buffer) {
  if (buffer.readUInt32LE(0) !== 0x04034b50) throw new Error("Invalid DOCX");
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length) throw new Error("Invalid archive");
  const count = buffer.readUInt16LE(end + 10),
    start = buffer.readUInt32LE(end + 16);
  if (count > 2000 || start >= end) throw new Error("Archive exceeds limits");
  let offset = start,
    total = 0,
    document = false;
  for (let i = 0; i < count; i++) {
    if (
      offset + 46 > buffer.length ||
      buffer.readUInt32LE(offset) !== 0x02014b50 ||
      buffer.readUInt16LE(offset + 8) & 1
    )
      throw new Error("Invalid or encrypted DOCX");
    total += buffer.readUInt32LE(offset + 24);
    if (total > 20 * 1024 * 1024) throw new Error("Archive exceeds limits");
    const length = buffer.readUInt16LE(offset + 28),
      extra = buffer.readUInt16LE(offset + 30),
      comment = buffer.readUInt16LE(offset + 32);
    const name = buffer
      .subarray(offset + 46, offset + 46 + length)
      .toString("utf8");
    if (name === "word/document.xml") document = true;
    offset += 46 + length + extra + comment;
    if (offset > end) throw new Error("Invalid archive");
  }
  if (!document) throw new Error("Not a Word document");
}
async function extract() {
  const input = workerData as { fileBase64: string; mimeType: string };
  const buffer = Buffer.from(input.fileBase64, "base64");
  let text = "";
  if (input.mimeType === "application/pdf") {
    if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
      throw new Error("Invalid PDF");
    const loading = getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useWorkerFetch: false,
      useSystemFonts: false,
      disableFontFace: true,
      maxImageSize: 0,
      verbosity: 0,
    });
    try {
      const pdf = await loading.promise;
      if (pdf.numPages > 30) throw new Error("Use a PDF up to 30 pages");
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const [content, annotations] = await Promise.all([
          page.getTextContent(),
          page.getAnnotations(),
        ]);
        text +=
          pdfPageText(
            content.items.flatMap((item) => ("str" in item ? [item] : [])),
            annotations as unknown[],
          ) + "\n";
        if (text.length > MAX_TEXT) throw new Error("Text exceeds limits");
      }
    } finally {
      await loading.destroy();
    }
  } else if (
    input.mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    checkDocx(buffer);
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (
    input.mimeType === "text/plain" ||
    input.mimeType === "text/markdown"
  ) {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } else throw new Error("Unsupported format");
  text = text
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[^\P{C}\n\t]/gu, "")
    .trim();
  if (!text || text.length > MAX_TEXT)
    throw new Error("No readable text or too much text");
  return text;
}
try {
  parentPort?.postMessage({ text: await extract() });
} catch {
  parentPort?.postMessage({ error: "invalid_input" });
}
