import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseUploadedResume } from "../dist/upload.js";
const request = (file, mimeType) => ({
  fileName: file,
  mimeType,
  fileBase64: readFileSync(
    new URL(`./fixtures/${file}`, import.meta.url),
  ).toString("base64"),
});
test("compressed text PDF extracts readable text-based text without a provider", async () => {
  const p = await parseUploadedResume(request("resume.pdf", "application/pdf"));
  assert.ok(p.rawText.includes("Synthetic Person"));
  assert.ok(p.rawText.includes("TypeScript"));
});
test("normal Word DOCX with ZIP central directory and compressed XML extracts text", async () => {
  const p = await parseUploadedResume(
    request(
      "resume.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
  );
  assert.ok(p.rawText.includes("supported user supplied facts"));
});
test("scanned, encrypted, over-page-limit and corrupt PDF fail with recoverable errors", async () => {
  for (const file of ["scan.pdf", "encrypted.pdf", "long.pdf"])
    await assert.rejects(
      parseUploadedResume(request(file, "application/pdf")),
      (e) => e.code === "invalid_input",
    );
  await assert.rejects(
    parseUploadedResume({
      fileName: "corrupt.pdf",
      mimeType: "application/pdf",
      fileBase64: Buffer.from("not a pdf").toString("base64"),
    }),
  );
});
test("malformed base64, invalid UTF-8, legacy DOC and oversized text are rejected", async () => {
  for (const data of [
    { fileName: "bad.txt", mimeType: "text/plain", fileBase64: "!!" },
    {
      fileName: "bad.txt",
      mimeType: "text/plain",
      fileBase64: Buffer.from([0xff, 0xfe]).toString("base64"),
    },
    { fileName: "old.doc", mimeType: "application/msword", rawText: "text" },
    {
      fileName: "long.txt",
      mimeType: "text/plain",
      fileBase64: Buffer.alloc(500001, 65).toString("base64"),
    },
  ])
    await assert.rejects(parseUploadedResume(data));
});
test("DOCX archive expansion limit rejects before decompression", async () => {
  const file = readFileSync(new URL("./fixtures/resume.docx", import.meta.url));
  const start = file.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  file.writeUInt32LE(21 * 1024 * 1024, start + 24);
  await assert.rejects(
    parseUploadedResume({
      fileName: "bomb.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBase64: file.toString("base64"),
    }),
    (e) => e.code === "invalid_input",
  );
});
