import { inflateSync, inflateRawSync } from "node:zlib";
import { ResumeError } from "./contracts.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DECOMPRESSED_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_TEXT_LENGTH = 500_000;

export interface ExtractedFileResult {
  readonly text: string;
  readonly detectedFormat: "pdf" | "docx" | "text" | "json";
}

/**
 * Extracts raw textual content from uploaded file buffers (PDF, DOCX, TXT, JSON, MD).
 */
export function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): ExtractedFileResult {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new ResumeError(
      "file_too_large",
      `File size ${String(buffer.length)} exceeds 10MB limit`,
    );
  }

  const lowerName = fileName.toLowerCase();

  // 1. PDF extraction
  if (
    mimeType === "application/pdf" ||
    lowerName.endsWith(".pdf") ||
    buffer.subarray(0, 5).toString("latin1").startsWith("%PDF-")
  ) {
    const text = extractTextFromPdf(buffer);
    return { text: sanitizeExtractedText(text), detectedFormat: "pdf" };
  }

  // 2. DOCX extraction (PKZip with word/document.xml)
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx") ||
    (buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04)
  ) {
    const text = extractTextFromDocx(buffer);
    return { text: sanitizeExtractedText(text), detectedFormat: "docx" };
  }

  // 3. JSON format
  if (
    mimeType === "application/json" ||
    lowerName.endsWith(".json")
  ) {
    const str = buffer.toString("utf8");
    return { text: sanitizeExtractedText(str), detectedFormat: "json" };
  }

  // 4. Plain text / Markdown
  const text = buffer.toString("utf8");
  return { text: sanitizeExtractedText(text), detectedFormat: "text" };
}

/**
 * Sanitizes extracted text: converts CRLF to LF, removes non-printable control chars
 * (preserving newlines, tabs, and printable unicode), and truncates to max length.
 */
export function sanitizeExtractedText(raw: string): string {
  const normalized = raw
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[^\P{C}\n\t]/gu, "") // strip control characters except \n and \t
    .trim();

  if (normalized.length > MAX_TEXT_LENGTH) {
    return normalized.slice(0, MAX_TEXT_LENGTH);
  }
  return normalized;
}

/**
 * Extracts text from PDF bytes by identifying content streams, inflating FlateDecode
 * streams, and parsing PDF text layout operators (Tj, TJ, ', ").
 */
export function extractTextFromPdf(buffer: Buffer): string {
  const textParts: string[] = [];
  const bufferString = buffer.toString("latin1");

  // Locate all stream ... endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(bufferString)) !== null) {
    const streamStart = match.index + match[0].indexOf("stream") + 6;
    // Skip optional \r\n
    let contentStart = streamStart;
    if (buffer[contentStart] === 0x0d && buffer[contentStart + 1] === 0x0a) {
      contentStart += 2;
    } else if (buffer[contentStart] === 0x0a) {
      contentStart += 1;
    }

    const endPos = match.index + match[0].lastIndexOf("endstream");
    const streamSlice = buffer.subarray(contentStart, endPos);

    // Check preceding dictionary for /FlateDecode
    const dictHeader = bufferString.slice(
      Math.max(0, match.index - 500),
      match.index,
    );

    let decompressed: Buffer;
    if (dictHeader.includes("/FlateDecode") || dictHeader.includes("/Fl")) {
      try {
        decompressed = inflateSync(streamSlice);
        if (decompressed.length > MAX_DECOMPRESSED_SIZE) {
          throw new ResumeError("file_too_large", "Decompressed size exceeds limit");
        }
      } catch {
        // If inflation fails, continue to next stream
        continue;
      }
    } else {
      decompressed = streamSlice;
    }

    const streamText = parsePdfContentStream(decompressed.toString("latin1"));
    if (streamText.trim()) {
      textParts.push(streamText);
    }
  }

  // Fallback if no streams matched or yielded text: scan for text literals in raw buffer
  if (textParts.length === 0) {
    const fallbackText = parsePdfContentStream(bufferString);
    if (fallbackText.trim()) {
      return fallbackText;
    }
  }

  return textParts.join("\n\n");
}

/**
 * Parses PDF text operators inside a decompressed content stream.
 * Handles Tj, TJ, TD, Td, T*, ', ", and text positioning.
 */
function parsePdfContentStream(streamContent: string): string {
  const lines: string[] = [];
  let currentLine = "";

  // Regex to match PDF text objects: BT ... ET
  const textBlockRegex = /BT([\s\S]*?)ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = textBlockRegex.exec(streamContent)) !== null) {
    const blockContent = blockMatch[1] ?? "";

    // Match text operations:
    // 1. (string) Tj or ' or "
    // 2. [(string) 120 (string)] TJ
    // 3. <hex> Tj
    // 4. T* or Td or TD (newline indicator)
    const opRegex =
      /\((?:\\\(|\\\)|[\s\S])*?\)\s*(?:Tj|'|")|\[[\s\S]*?\]\s*TJ|<[0-9a-fA-F\s]+>\s*Tj|(?:T\*|(?:\s*[-0-9.]+\s+[-0-9.]+\s+T[dD]))/g;

    let opMatch: RegExpExecArray | null;
    while ((opMatch = opRegex.exec(blockContent)) !== null) {
      const op = opMatch[0].trim();

      if (op === "T*" || /[-0-9.]+\s+[-0-9.]+\s+T[dD]$/.test(op)) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = "";
        }
        continue;
      }

      if (op.endsWith("TJ")) {
        // Array of strings and kerning offsets
        const arrayBody = op.slice(1, op.lastIndexOf("]"));
        const textElements = extractPdfStringsFromArray(arrayBody);
        currentLine += (currentLine.endsWith(" ") ? "" : " ") + textElements;
      } else if (op.startsWith("(")) {
        const strVal = decodePdfString(op.slice(1, op.lastIndexOf(")")));
        currentLine += (currentLine.endsWith(" ") ? "" : " ") + strVal;
      } else if (op.startsWith("<")) {
        const hex = op.slice(1, op.indexOf(">")).replace(/\s+/g, "");
        const decoded = Buffer.from(hex, "hex").toString("utf8");
        currentLine += (currentLine.endsWith(" ") ? "" : " ") + decoded;
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }

  return lines.join("\n");
}

function extractPdfStringsFromArray(arrayContent: string): string {
  let result = "";
  const itemRegex = /\(((?:\\\(|\\\)|[\s\S])*?)\)|<([0-9a-fA-F\s]+)>|(-?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(arrayContent)) !== null) {
    if (match[1] !== undefined) {
      result += decodePdfString(match[1]);
    } else if (match[2] !== undefined) {
      const hex = match[2].replace(/\s+/g, "");
      result += Buffer.from(hex, "hex").toString("utf8");
    } else if (match[3] !== undefined) {
      const spacing = parseFloat(match[3]);
      // Negative large number in TJ often indicates space between words
      if (spacing < -150) {
        result += " ";
      }
    }
  }
  return result;
}

function decodePdfString(str: string): string {
  return str
    .replaceAll("\\\\", "\\")
    .replaceAll("\\(", "(")
    .replaceAll("\\)", ")")
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
    .replaceAll("\\b", "\b")
    .replaceAll("\\f", "\f")
    .replace(/\\([0-7]{1,3})/g, (_: string, oct: string): string =>
      String.fromCharCode(parseInt(oct, 8)),
    );
}

/**
 * Extracts text from DOCX (PKZip format) by locating `word/document.xml`
 * and extracting all paragraph text runs.
 */
export function extractTextFromDocx(buffer: Buffer): string {
  // Check ZIP magic header: PK\x03\x04
  if (
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    throw new ResumeError("unsupported_media_type", "Invalid DOCX archive format");
  }

  let offset = 0;
  let documentXml: string | null = null;

  while (offset + 30 < buffer.length) {
    if (
      buffer[offset] !== 0x50 ||
      buffer[offset + 1] !== 0x4b ||
      buffer[offset + 2] !== 0x03 ||
      buffer[offset + 3] !== 0x04
    ) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileName = buffer
      .subarray(fileNameStart, fileNameStart + fileNameLength)
      .toString("utf8");

    const dataStart = fileNameStart + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buffer.length) break;

    if (fileName === "word/document.xml") {
      const compressedData = buffer.subarray(dataStart, dataEnd);
      let xmlBuffer: Buffer;
      if (compressionMethod === 0) {
        xmlBuffer = compressedData;
      } else if (compressionMethod === 8) {
        xmlBuffer = inflateRawSync(compressedData);
      } else {
        throw new ResumeError(
          "unsupported_media_type",
          `Unsupported DOCX compression method: ${String(compressionMethod)}`,
        );
      }
      documentXml = xmlBuffer.toString("utf8");
      break;
    }

    offset = dataEnd;
  }

  if (!documentXml) {
    // Fallback: search for <w:document in buffer
    const xmlStart = buffer.indexOf("<w:document");
    if (xmlStart !== -1) {
      const xmlEnd = buffer.indexOf("</w:document>", xmlStart);
      if (xmlEnd !== -1) {
        documentXml = buffer
          .subarray(xmlStart, xmlEnd + "</w:document>".length)
          .toString("utf8");
      }
    }
  }

  if (!documentXml) {
    throw new ResumeError(
      "unsupported_media_type",
      "Could not find word/document.xml in DOCX file",
    );
  }

  return parseDocxXml(documentXml);
}

/**
 * Extracts plain text paragraphs from DOCX XML.
 * Each `<w:p>` is parsed for text `<w:t>` elements and line breaks `<w:br/>`.
 */
function parseDocxXml(xml: string): string {
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[0];
    let pText = "";

    const textOrBrRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:br\/>|<w:tab\/>/g;
    let tMatch: RegExpExecArray | null;

    while ((tMatch = textOrBrRegex.exec(pContent)) !== null) {
      if (tMatch[1] !== undefined) {
        pText += decodeXmlEntities(tMatch[1]);
      } else if (tMatch[0] === "<w:br/>") {
        pText += "\n";
      } else if (tMatch[0] === "<w:tab/>") {
        pText += "\t";
      }
    }

    if (pText.trim()) {
      paragraphs.push(pText.trim());
    }
  }

  return paragraphs.join("\n");
}

function decodeXmlEntities(str: string): string {
  return str
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
