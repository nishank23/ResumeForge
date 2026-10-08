import { Worker } from "node:worker_threads";
import {
  ResumeError,
  resumeParseRequestSchema,
  type ResumeParseRequest,
} from "./contracts.js";
import { parseResumeText } from "./parser.js";
let active = 0;
export async function parseUploadedResume(input: ResumeParseRequest) {
  const parsed = resumeParseRequestSchema.safeParse(input);
  if (!parsed.success) throw new ResumeError("invalid_input");
  const data = parsed.data;
  if (
    ![
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
    ].includes(data.mimeType)
  )
    throw new ResumeError("unsupported_media_type");
  const base64 =
    data.fileBase64 ?? Buffer.from(data.rawText ?? "").toString("base64");
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      base64,
    ) ||
    !base64
  )
    throw new ResumeError("invalid_input");
  const length = Buffer.byteLength(base64, "base64");
  if (length > 10 * 1024 * 1024) throw new ResumeError("file_too_large");
  if (active >= 2) throw new ResumeError("resume_unavailable");
  active++;
  try {
    const text = await new Promise<string>((resolve, reject) => {
      // Same compiled worker in tsx development and built service; dev:personal
      // builds services first. CPU/memory limits isolate untrusted extraction.
      const worker = new Worker(
        new URL("../dist/upload-worker.js", import.meta.url),
        {
          workerData: { fileBase64: base64, mimeType: data.mimeType },
          env: {},
          resourceLimits: {
            maxOldGenerationSizeMb: 128,
            maxYoungGenerationSizeMb: 32,
          },
          execArgv: [],
        },
      );
      let settled = false;
      const done = (text?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate();
        if (text) resolve(text);
        else
          reject(
            new ResumeError(
              "invalid_input",
              "Could not extract readable text. Use an unencrypted text-based file.",
            ),
          );
      };
      const timer = setTimeout(() => { done(); }, 8000);
      worker.once("message", (value: unknown) => {
        const result = value as { text?: unknown };
        done(typeof result.text === "string" ? result.text : undefined);
      });
      worker.once("error", () => { done(); });
      worker.once("exit", () => { done(); });
    });
    return parseResumeText(text, data.fileName);
  } finally {
    active--;
  }
}
