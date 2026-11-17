import { parentPort, workerData } from "node:worker_threads";
import { editorDocumentSchema } from "@resume-forge/shared-types";
import { renderResumePdf } from "./resume-pdf-template.js";
try {
  const input = workerData as { draft: unknown; inspect: boolean };
  const draft = editorDocumentSchema.parse(input.draft);
  const bytes = await renderResumePdf(draft);
  if (input.inspect) {
    const { inspectPdfBytes } = await import("./inspect-pdf.js");
    parentPort?.postMessage({
      analysis: await inspectPdfBytes(draft, new Uint8Array(bytes)),
    });
  } else parentPort?.postMessage({ bytes: new Uint8Array(bytes) });
} catch (error) {
  const code =
    error instanceof Error &&
    ["pdf_unsupported_characters", "pdf_too_large"].includes(error.message)
      ? error.message
      : "resume_unavailable";
  parentPort?.postMessage({ code });
}
