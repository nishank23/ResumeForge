import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type {
  EditorDocument,
  ReadabilityAnalysis,
} from "@resume-forge/shared-types";
import { pdfPageText } from "./pdf-text.js";
import { comparePdfReadability } from "./pdf-readability.js";

/** Runs inside the existing bounded PDF worker. No network, OCR or AI. */
export async function inspectPdfBytes(
  doc: EditorDocument,
  bytes: Uint8Array,
): Promise<ReadabilityAnalysis> {
  const loading = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useWorkerFetch: false,
    useSystemFonts: false,
    disableFontFace: true,
    maxImageSize: 0,
    verbosity: 0,
  });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > 30) throw new Error("Readability page limit exceeded.");
    const pages: ReadabilityAnalysis["pages"] = [];
    let size = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Annotation URLs are not visible text and must not conceal lost content.
      const text = pdfPageText(
        content.items.flatMap((item) => ("str" in item ? [item] : [])),
        [],
      );
      size += text.length;
      if (size > 200000) throw new Error("Readability text limit exceeded.");
      pages.push({ page: i, text });
      page.cleanup();
    }
    return comparePdfReadability(doc, pages);
  } finally {
    await loading.destroy();
  }
}
