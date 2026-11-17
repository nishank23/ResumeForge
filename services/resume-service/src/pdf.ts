import { Worker } from "node:worker_threads";
import {
  readabilityAnalysisSchema,
  type ReadabilityAnalysis,
} from "@resume-forge/shared-types";
import { ResumeError } from "./contracts.js";

// PDF exports and readability checks share one two-worker limit.
let active = 0;
async function runPdfWorker(
  draft: unknown,
  inspect: boolean,
): Promise<Uint8Array | ReadabilityAnalysis> {
  if (active >= 2) throw new ResumeError("resume_unavailable");
  active++;
  let worker: Worker | undefined;
  try {
    return await new Promise((resolve, reject) => {
      worker = new Worker(new URL("../dist/pdf-worker.js", import.meta.url), {
        workerData: { draft, inspect },
        env: {},
        execArgv: [],
        resourceLimits: {
          maxOldGenerationSizeMb: 256,
          maxYoungGenerationSizeMb: 32,
        },
      });
      const timer = setTimeout(
        () => { reject(new ResumeError("resume_unavailable")); },
        inspect ? 35000 : 25000,
      );
      worker.once(
        "message",
        (value: { bytes?: unknown; analysis?: unknown; code?: string }) => {
          clearTimeout(timer);
          if (
            !inspect &&
            value.bytes instanceof Uint8Array &&
            value.bytes.length <= 15 * 1024 * 1024
          )
            resolve(value.bytes);
          else if (
            inspect &&
            readabilityAnalysisSchema.safeParse(value.analysis).success
          )
            resolve(readabilityAnalysisSchema.parse(value.analysis));
          else
            reject(
              new ResumeError(
                value.code === "pdf_unsupported_characters" ||
                  value.code === "pdf_too_large"
                  ? "invalid_input"
                  : "resume_unavailable",
              ),
            );
        },
      );
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
export async function renderSavedResumePdf(
  draft: unknown,
): Promise<Uint8Array> {
  const result = await runPdfWorker(draft, false);
  if (!(result instanceof Uint8Array))
    throw new ResumeError("resume_unavailable");
  return result;
}
export async function inspectSavedResumePdf(
  draft: unknown,
): Promise<ReadabilityAnalysis> {
  return readabilityAnalysisSchema.parse(await runPdfWorker(draft, true));
}
