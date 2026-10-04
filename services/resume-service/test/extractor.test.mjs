import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync, deflateRawSync } from "node:zlib";
import {
  extractTextFromFile,
  sanitizeExtractedText,
  extractTextFromPdf,
  extractTextFromDocx,
} from "../dist/extractor.js";

test("text extractor extracts and sanitizes plain text and markdown", () => {
  const input = "John Doe\r\nSoftware Engineer\r\nEmail: john@example.com\n\0";
  const buffer = Buffer.from(input, "utf8");
  const result = extractTextFromFile(buffer, "text/plain", "resume.txt");

  assert.equal(result.detectedFormat, "text");
  assert.ok(result.text.includes("John Doe"));
  assert.ok(result.text.includes("Software Engineer"));
  assert.ok(!result.text.includes("\r"));
  assert.ok(!result.text.includes("\0"));
});

test("text extractor parses PDF streams with FlateDecode and text operators", () => {
  // Construct a minimal valid PDF content stream with Deflate
  const textStream = "BT\n/F1 12 Tf\n(Jane Doe) Tj\nT*\n[(Senior) 100 (Developer)] TJ\nET";
  const deflated = deflateSync(Buffer.from(textStream, "utf8"));

  const pdfBody =
    "%PDF-1.4\n" +
    "1 0 obj\n" +
    "<< /Length " +
    deflated.length +
    " /Filter /FlateDecode >>\n" +
    "stream\n" +
    deflated.toString("latin1") +
    "\nendstream\n" +
    "endobj\n" +
    "xref\n0 2\n0000000000 65535 f \n0000000010 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n100\n%%EOF";

  const pdfBuffer = Buffer.from(pdfBody, "latin1");
  const extracted = extractTextFromPdf(pdfBuffer);

  assert.ok(extracted.includes("Jane Doe"));
  assert.ok(extracted.includes("Senior Developer") || extracted.includes("Senior") && extracted.includes("Developer"));
});

test("text extractor parses DOCX archives containing word/document.xml", () => {
  const xmlContent =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    "<w:body>" +
    "<w:p><w:r><w:t>Alice Smith</w:t></w:r></w:p>" +
    "<w:p><w:r><w:t>Lead Architect</w:t><w:br/><w:t>Cloud Solutions</w:t></w:r></w:p>" +
    "</w:body>" +
    "</w:document>";

  const deflatedXml = deflateRawSync(Buffer.from(xmlContent, "utf8"));
  const fileName = "word/document.xml";
  const fileNameBuf = Buffer.from(fileName, "utf8");

  // Construct a minimal valid ZIP local file header (PK\x03\x04)
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6); // general purpose flags
  header.writeUInt16LE(8, 8); // compression method (8 = deflate)
  header.writeUInt16LE(0, 10); // last mod file time
  header.writeUInt16LE(0, 12); // last mod file date
  header.writeUInt32LE(0x12345678, 14); // crc-32
  header.writeUInt32LE(deflatedXml.length, 18); // compressed size
  header.writeUInt32LE(Buffer.byteLength(xmlContent), 22); // uncompressed size
  header.writeUInt16LE(fileNameBuf.length, 26); // file name length
  header.writeUInt16LE(0, 28); // extra field length

  const docxBuffer = Buffer.concat([header, fileNameBuf, deflatedXml]);
  const extracted = extractTextFromDocx(docxBuffer);

  assert.ok(extracted.includes("Alice Smith"));
  assert.ok(extracted.includes("Lead Architect"));
  assert.ok(extracted.includes("Cloud Solutions"));
});

test("text extractor rejects files exceeding 10MB limit", () => {
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1024);
  assert.throws(
    () => extractTextFromFile(oversized, "application/pdf", "large.pdf"),
    (err) => err.code === "file_too_large",
  );
});

test("text extractor handles corrupt or invalid docx safely", () => {
  const corrupt = Buffer.from("Not a real zip or docx file", "utf8");
  assert.throws(
    () => extractTextFromDocx(corrupt),
    (err) => err.code === "unsupported_media_type",
  );
});
