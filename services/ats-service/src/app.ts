import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import {
  ATS_RUBRIC,
  atsAssessmentInputSchema,
  atsAssessmentSchema,
} from "@resume-forge/shared-types";
import { AtsUnavailable, type AtsAssessor } from "./assessment.js";
import { ATS_GEMINI_MODEL, ATS_PROVIDER_TIMEOUT_MS } from "./gemini.js";
export const ATS_MAX_BODY_BYTES = 384_000;
class InvalidRequest extends Error {
  constructor(readonly status: 400 | 413) {
    super();
  }
}
async function readBody(
  request: Request,
  signal: AbortSignal,
): Promise<unknown> {
  const declared = request.headers.get("Content-Length");
  if (
    declared &&
    (!/^\d+$/.test(declared) || Number(declared) > ATS_MAX_BODY_BYTES)
  )
    throw new InvalidRequest(413);
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new InvalidRequest(400);
  if (!request.body) throw new InvalidRequest(400);
  const reader =
    request.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  let size = 0;
  const chunks: Uint8Array[] = [];
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (
      let item = await reader.read();
      !item.done;
      item = await reader.read()
    ) {
      if (signal.aborted) throw new AtsUnavailable();
      size += item.value.byteLength;
      if (size > ATS_MAX_BODY_BYTES) {
        await reader.cancel();
        throw new InvalidRequest(413);
      }
      chunks.push(item.value);
    }
    if (signal.aborted) throw new AtsUnavailable();
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch {
      throw new InvalidRequest(400);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
export function createAtsApp(options: {
  key: string;
  assess: AtsAssessor;
  available?: boolean;
  timeoutMs?: number;
}) {
  if (options.key.length < 32)
    throw new Error(
      "ATS service requires a private key of at least 32 characters.",
    );
  const expected = createHash("sha256").update(options.key).digest();
  const timeoutMs = options.timeoutMs ?? ATS_PROVIDER_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
    throw new Error("Invalid ATS timeout.");
  let active = 0;
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Content-Type-Options", "nosniff");
    const authorization = c.req.header("Authorization") ?? "";
    const supplied = createHash("sha256")
      .update(authorization.startsWith("Bearer ") ? authorization.slice(7) : "")
      .digest();
    if (!timingSafeEqual(expected, supplied))
      return c.json(
        {
          error: {
            code: "unauthorized",
            message: "Internal service authorization required.",
          },
        },
        401,
      );
    await next();
  });
  app.get("/internal/ats/health", (c) =>
    c.json({
      status: "ok",
      rubricVersion: ATS_RUBRIC,
      model: ATS_GEMINI_MODEL,
      available: options.available ?? true,
    }),
  );
  app.post("/internal/ats/assess", async (c) => {
    if (active >= 2)
      return c.json(
        {
          error: {
            code: "ats_busy",
            message: "Job analysis is busy. Retry shortly.",
          },
        },
        503,
      );
    active++;
    const abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, c.req.raw.signal]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(new AtsUnavailable("Job analysis timed out. Retry shortly."));
      }, timeoutMs);
    });
    const operation = (async () => {
      const value = await readBody(c.req.raw, signal);
      const parsed = atsAssessmentInputSchema.safeParse(value);
      if (!parsed.success) throw new InvalidRequest(400);
      return atsAssessmentSchema.parse(
        await options.assess(parsed.data, signal),
      );
    })();
    // Keep a slot until work truly settles, even when a custom provider ignores cancellation.
    void operation.then(
      () => {
        active--;
      },
      () => {
        active--;
      },
    );
    try {
      return c.json(await Promise.race([operation, timeout]));
    } catch (error) {
      if (error instanceof InvalidRequest)
        return c.json(
          {
            error: {
              code: "invalid_input",
              message:
                "Use a bounded job description and distinct professional sources.",
            },
          },
          error.status,
        );
      return c.json(
        {
          error: {
            code: "ats_unavailable",
            message:
              error instanceof AtsUnavailable
                ? error.message
                : "Job analysis is unavailable. Retry shortly.",
          },
        },
        503,
      );
    } finally {
      clearTimeout(timer);
    }
  });
  app.notFound((c) =>
    c.json(
      { error: { code: "not_found", message: "Route unavailable." } },
      404,
    ),
  );
  app.onError((_error, c) =>
    c.json(
      {
        error: {
          code: "ats_unavailable",
          message: "Job analysis is unavailable. Retry shortly.",
        },
      },
      503,
    ),
  );
  return app;
}
