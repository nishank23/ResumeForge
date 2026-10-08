import { Worker } from "node:worker_threads";
import { ResumeError } from "./contracts.js";
let active = 0;
export async function renderSavedResumePdf(
  draft: unknown,
): Promise<Uint8Array> {
  if (active >= 2) throw new ResumeError("resume_unavailable");
  active++;
  let worker: Worker | undefined;
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      worker = new Worker(new URL("../dist/pdf-worker.js", import.meta.url), {
        workerData: draft,
        env: {},
        execArgv: [],
        resourceLimits: {
          maxOldGenerationSizeMb: 256,
          maxYoungGenerationSizeMb: 32,
        },
      });
      const timer = setTimeout(() => {
        reject(new ResumeError("resume_unavailable"));
      }, 25_000);
      worker.once("message", (value: { bytes?: unknown; code?: string }) => {
        clearTimeout(timer);
        if (
          value.bytes instanceof Uint8Array &&
          value.bytes.length <= 15 * 1024 * 1024
        )
          resolve(value.bytes);
        else
          reject(
            new ResumeError(
              value.code === "pdf_unsupported_characters" ||
                value.code === "pdf_too_large"
                ? "invalid_input"
                : "resume_unavailable",
            ),
          );
      });
      worker.once("error", () => {
        clearTimeout(timer);
        reject(new ResumeError("resume_unavailable"));
      });
      worker.once("exit", () => {
        clearTimeout(timer);
        reject(new ResumeError("resume_unavailable"));
      });
    });
  } finally {
    await worker?.terminate();
    active--;
  }
}
