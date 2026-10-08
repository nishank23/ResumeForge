import { parentPort, workerData } from "node:worker_threads";
import { renderResumePdf } from "./resume-pdf-template.js";
try {
  const bytes = await renderResumePdf(workerData as unknown);
  parentPort?.postMessage({ bytes: new Uint8Array(bytes) });
} catch (error) {
  const code =
    error instanceof Error &&
    ["pdf_unsupported_characters", "pdf_too_large"].includes(error.message)
      ? error.message
      : "resume_unavailable";
  parentPort?.postMessage({ code });
}
