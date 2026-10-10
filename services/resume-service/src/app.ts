import { z } from "zod";
import { AiUnavailable } from "./ats/ai.js";
import { randomUUID } from "node:crypto";
import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { BlankEnv } from "hono/types";
import { parseUploadedResume } from "./upload.js";
import type { ActorResolution } from "@resume-forge/access-policy/server";
import type { createResumeUseCases } from "./resume.js";
import { ResumeError } from "./contracts.js";

export function createResumeApp(config: {
  resolveActor: (authorization: string | undefined) => Promise<ActorResolution>;
  resumes: ReturnType<typeof createResumeUseCases>;
  personalEditorOnly?: boolean;
}) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    await next();
  });

  const localCors = cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "X-Workspace-Id"],
  });

  app.use("/api/v1/resume/*", localCors);
  app.use("/api/v1/resume", localCors);
  app.use("/api/v1/jd/*", localCors);
  app.use("/api/v1/jd", localCors);
  app.use("/api/v1/task-run/*", localCors);
  app.use("/api/v1/task-run", localCors);

  if (config.personalEditorOnly)
    app.use("/api/v1/*", async (c, next) => {
      const path = c.req.path,
        method = c.req.method;
      const allowed =
        (path === "/api/v1/resume" &&
          ["GET", "POST", "OPTIONS"].includes(method)) ||
        (path === "/api/v1/resume/parse" &&
          ["POST", "OPTIONS"].includes(method)) ||
        (/^\/api\/v1\/resume\/[0-9a-f-]{36}$/i.test(path) &&
          ["GET", "PUT", "DELETE", "OPTIONS"].includes(method)) ||
        (/^\/api\/v1\/resume\/[0-9a-f-]{36}\/pdf$/i.test(path) &&
          ["GET", "OPTIONS"].includes(method)) ||
        (/^\/api\/v1\/resume\/[0-9a-f-]{36}\/readiness$/i.test(path) &&
          ["GET", "POST", "OPTIONS"].includes(method)) ||
        (/^\/api\/v1\/resume\/[0-9a-f-]{36}\/readiness\/preferences$/i.test(
          path,
        ) &&
          ["PUT", "OPTIONS"].includes(method)) ||
        (/^\/api\/v1\/resume\/[0-9a-f-]{36}\/(jd-match|ai-rewrite)$/i.test(
          path,
        ) &&
          ["GET", "POST", "OPTIONS"].includes(method)) ||
        (/^\/api\/v1\/resume\/[0-9a-f-]{36}\/jd-match\/preferences$/i.test(
          path,
        ) &&
          ["PUT", "OPTIONS"].includes(method)) ||
        (/^\/api\/v1\/resume\/[0-9a-f-]{36}\/ai-rewrite\/apply$/i.test(path) &&
          ["POST", "OPTIONS"].includes(method)) ||
        (/^\/api\/v1\/resume\/[0-9a-f-]{36}\/restore$/i.test(path) &&
          ["POST", "OPTIONS"].includes(method));
      if (!allowed)
        return c.json(
          {
            error: {
              code: "not_found",
              message: "Route is unavailable in the personal editor.",
            },
          },
          404,
        );
      await next();
    });

  app.onError((_error, c) =>
    c.json(
      {
        error: {
          code: "resume_unavailable",
          message: "Resume service is temporarily unavailable.",
        },
      },
      503,
    ),
  );

  const fail = (
    c: Context,
    code: string,
    message: string,
    status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 503,
    requestId: string,
  ) =>
    c.json(
      {
        error: { code, message },
        requestId,
      },
      status,
    );

  // Authenticate helper
  async function authenticate(c: Context, requestId: string) {
    const resolution = await config.resolveActor(c.req.header("Authorization"));
    if (resolution.status !== "authenticated") {
      return {
        authenticated: false as const,
        response: fail(
          c,
          resolution.status === "unauthenticated"
            ? "unauthenticated"
            : "resume_unavailable",
          "Authentication failed.",
          resolution.status === "unauthenticated" ? 401 : 503,
          requestId,
        ),
      };
    }
    return {
      authenticated: true as const,
      context: {
        actor: resolution.actor,
        selectedWorkspaceId: c.req.header("X-Workspace-Id"),
        correlationId: requestId,
      },
    };
  }

  app.use(
    "/api/v1/resume/*",
    async (c: Context<BlankEnv, string>, next: Next) =>
      bodyLimit({
        maxSize: ["/api/v1/resume/parse", "/api/v1/resume/import"].includes(
          c.req.path,
        )
          ? 15_000_000
          : 2_000_000,
        onError: (c) =>
          c.json(
            {
              error: {
                code: "file_too_large",
                message: "Upload is too large.",
              },
            },
            413,
          ),
      })(c, next),
  );
  app.use(
    "/api/v1/resume",
    bodyLimit({
      maxSize: 2_000_000,
      onError: (c) =>
        c.json(
          {
            error: {
              code: "file_too_large",
              message: "Document is too large.",
            },
          },
          413,
        ),
    }),
  );
  app.post("/api/v1/resume", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;
    try {
      return c.json(
        {
          data: await config.resumes.createResume(
            auth.context,
            await c.req.json(),
          ),
          requestId,
        },
        201,
      );
    } catch (err) {
      return fail(
        c,
        err instanceof ResumeError ? err.code : "resume_unavailable",
        "Could not create resume.",
        err instanceof ResumeError
          ? err.code === "revision_conflict"
            ? 409
            : err.code === "forbidden"
              ? 403
              : 422
          : 503,
        requestId,
      );
    }
  });

  // Authenticated review staging: parsing never persists a resume.
  app.post("/api/v1/resume/parse", async (c) => {
    const requestId = randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;
    c.header("X-Request-Id", requestId);

    try {
      let body: unknown;
      const contentType = c.req.header("Content-Type") ?? "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await c.req.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") {
          return fail(
            c,
            "invalid_input",
            "File is required in form-data",
            422,
            requestId,
          );
        }
        const fileObj = file as File;
        const arrayBuffer = await fileObj.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        body = {
          fileName: fileObj.name,
          mimeType: fileObj.type || "application/pdf",
          fileBase64: base64,
        };
      } else if (contentType.includes("application/json")) {
        body = await c.req.json();
      } else {
        return fail(
          c,
          "unsupported_media_type",
          "Content-Type must be application/json or multipart/form-data",
          415,
          requestId,
        );
      }

      await config.resumes.authorizeUpload(auth.context);
      const result = await parseUploadedResume(
        body as Parameters<typeof config.resumes.parseResumeOnly>[0],
      );
      const currentAuth = await authenticate(c, requestId);
      if (!currentAuth.authenticated) return currentAuth.response;
      await config.resumes.authorizeUpload(currentAuth.context);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        const statusMap: Record<
          string,
          400 | 401 | 403 | 404 | 413 | 415 | 422 | 503
        > = {
          invalid_input: 422,
          file_too_large: 413,
          unsupported_media_type: 415,
          unauthenticated: 401,
          forbidden: 403,
          not_found: 404,
          resume_unavailable: 503,
        };
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to parse resume",
        503,
        requestId,
      );
    }
  });

  // Import endpoint (requires authentication & persistence)
  app.post("/api/v1/resume/import", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    try {
      let body: unknown;
      const contentType = c.req.header("Content-Type") ?? "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await c.req.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") {
          return fail(
            c,
            "invalid_input",
            "File is required in form-data",
            422,
            requestId,
          );
        }
        const fileObj = file as File;
        const arrayBuffer = await fileObj.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const title = formData.get("title");
        const templateId = formData.get("templateId");

        body = {
          fileName: fileObj.name,
          mimeType: fileObj.type || "application/pdf",
          fileBase64: base64,
          ...(title && typeof title === "string" ? { title } : {}),
          ...(templateId && typeof templateId === "string"
            ? { templateId }
            : {}),
        };
      } else if (contentType.includes("application/json")) {
        body = await c.req.json();
      } else {
        return fail(
          c,
          "unsupported_media_type",
          "Content-Type must be application/json or multipart/form-data",
          415,
          requestId,
        );
      }

      const result = await config.resumes.importResume(
        auth.context,
        body as Parameters<typeof config.resumes.importResume>[1],
      );
      return c.json({ data: result, requestId }, 201);
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        const statusMap: Record<
          string,
          400 | 401 | 403 | 404 | 413 | 415 | 422 | 503
        > = {
          invalid_input: 422,
          file_too_large: 413,
          unsupported_media_type: 415,
          unauthenticated: 401,
          forbidden: 403,
          not_found: 404,
          resume_unavailable: 503,
        };
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to import resume",
        503,
        requestId,
      );
    }
  });

  const statusMap: Record<
    string,
    400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 503
  > = {
    invalid_input: 422,
    file_too_large: 413,
    unsupported_media_type: 415,
    unauthenticated: 401,
    forbidden: 403,
    not_found: 404,
    revision_conflict: 409,
    resume_unavailable: 503,
  };

  app.post("/api/v1/resume/:id/restore", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;
    try {
      const result = await config.resumes.restoreResume(
        auth.context,
        c.req.param("id"),
        await c.req.json().catch(() => {
          throw new ResumeError("invalid_input");
        }),
      );
      return c.json({ data: result, requestId });
    } catch (error) {
      if (error instanceof ResumeError)
        return fail(
          c,
          error.code,
          error.message,
          statusMap[error.code] ?? 422,
          requestId,
        );
      return fail(
        c,
        "resume_unavailable",
        "Could not restore resume.",
        503,
        requestId,
      );
    }
  });
  app.get("/api/v1/resume/:id/pdf", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;
    const version = c.req.query("version");
    if (
      new URL(c.req.url).searchParams.getAll("version").length !== 1 ||
      !version ||
      !/^[1-9][0-9]{0,8}$/.test(version) ||
      Array.from(new URL(c.req.url).searchParams.keys()).some(
        (key) => key !== "version",
      )
    )
      return fail(
        c,
        "invalid_input",
        "Choose a saved version.",
        422,
        requestId,
      );
    try {
      const result = await config.resumes.downloadPdf(
        auth.context,
        c.req.param("id"),
        Number(version),
      );
      const latest = await authenticate(c, requestId);
      if (!latest.authenticated) return latest.response;
      if (
        latest.context.actor.userId !== auth.context.actor.userId ||
        latest.context.actor.personalWorkspaceId !==
          auth.context.actor.personalWorkspaceId
      )
        return fail(c, "unauthenticated", "Session changed.", 401, requestId);
      c.header("Content-Type", "application/pdf");
      c.header(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );
      c.header("X-Resume-Version", String(result.version));
      c.header("X-Content-Type-Options", "nosniff");
      return c.body(new Uint8Array(result.bytes));
    } catch (error) {
      if (error instanceof ResumeError)
        return fail(
          c,
          error.code,
          error.message,
          statusMap[error.code] ?? 422,
          requestId,
        );
      return fail(
        c,
        "resume_unavailable",
        "Could not prepare PDF. Retry.",
        503,
        requestId,
      );
    }
  });

  async function atsRequest(
    c: Context,
    operation: (
      context: Parameters<typeof config.resumes.getJdMatch>[0],
      id: string,
      body: unknown,
    ) => Promise<unknown>,
  ) {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;
    try {
      return c.json({
        data: await operation(
          auth.context,
          c.req.param("id") ?? "",
          c.req.method === "GET" ? undefined : await c.req.json(),
        ),
        requestId,
      });
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof z.ZodError)
        return fail(
          c,
          "invalid_input",
          "The ATS request or saved document is invalid.",
          422,
          requestId,
        );
      if (error instanceof AiUnavailable)
        return fail(c, "resume_unavailable", error.message, 503, requestId);
      if (error instanceof ResumeError)
        return fail(
          c,
          error.code,
          error.message,
          error.code === "revision_conflict"
            ? 409
            : error.code === "not_found"
              ? 404
              : error.code === "forbidden"
                ? 403
                : error.code === "unauthenticated"
                  ? 401
                  : 422,
          requestId,
        );
      return fail(
        c,
        "resume_unavailable",
        "ATS or AI request failed. Retry or edit manually.",
        503,
        requestId,
      );
    }
  }
  app.on(["GET", "POST"], "/api/v1/resume/:id/jd-match", (c) =>
    atsRequest(c, (context, id, body) =>
      c.req.method === "GET"
        ? config.resumes.getJdMatch(context, id)
        : config.resumes.runJdMatch(context, id, body),
    ),
  );
  app.put("/api/v1/resume/:id/jd-match/preferences", (c) =>
    atsRequest(c, config.resumes.updateJdPreference),
  );
  app.post("/api/v1/resume/:id/ai-rewrite", (c) =>
    atsRequest(c, config.resumes.requestRewrite),
  );
  app.post("/api/v1/resume/:id/ai-rewrite/apply", (c) =>
    atsRequest(c, config.resumes.applySavedRewrite),
  );
  app.on(["GET", "POST"], "/api/v1/resume/:id/readiness", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;
    try {
      const result =
        c.req.method === "GET"
          ? await config.resumes.getReadiness(auth.context, c.req.param("id"))
          : await config.resumes.runReadiness(
              auth.context,
              c.req.param("id"),
              await c.req.json(),
            );
      return c.json({ data: result, requestId });
    } catch (error) {
      if (error instanceof SyntaxError)
        return fail(
          c,
          "invalid_input",
          "Use a valid JSON readiness request.",
          422,
          requestId,
        );
      if (error instanceof ResumeError)
        return fail(
          c,
          error.code,
          error.message,
          error.code === "revision_conflict"
            ? 409
            : error.code === "not_found"
              ? 404
              : error.code === "forbidden"
                ? 403
                : error.code === "unauthenticated"
                  ? 401
                  : error.code === "resume_unavailable"
                    ? 503
                    : 422,
          requestId,
        );
      return fail(
        c,
        "resume_unavailable",
        "Could not evaluate readiness. Retry.",
        503,
        requestId,
      );
    }
  });
  app.put("/api/v1/resume/:id/readiness/preferences", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;
    try {
      return c.json({
        data: await config.resumes.updateReadinessPreference(
          auth.context,
          c.req.param("id"),
          await c.req.json(),
        ),
        requestId,
      });
    } catch (error) {
      if (error instanceof SyntaxError)
        return fail(
          c,
          "invalid_input",
          "Use a valid JSON feedback request.",
          422,
          requestId,
        );
      if (error instanceof ResumeError)
        return fail(
          c,
          error.code,
          error.message,
          error.code === "revision_conflict"
            ? 409
            : error.code === "not_found"
              ? 404
              : error.code === "forbidden"
                ? 403
                : error.code === "unauthenticated"
                  ? 401
                  : error.code === "resume_unavailable"
                    ? 503
                    : 422,
          requestId,
        );
      return fail(
        c,
        "resume_unavailable",
        "Could not update feedback. Retry.",
        503,
        requestId,
      );
    }
  });

  // Get single resume by ID
  app.get("/api/v1/resume/:id", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      const result = await config.resumes.getResumeById(auth.context, id);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 404,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to retrieve resume",
        503,
        requestId,
      );
    }
  });

  // Update resume by ID
  app.put("/api/v1/resume/:id", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      const contentType = c.req.header("Content-Type") ?? "";
      if (!contentType.includes("application/json")) {
        return fail(
          c,
          "unsupported_media_type",
          "Content-Type must be application/json",
          415,
          requestId,
        );
      }
      const body: unknown = await c.req.json();
      const result = await config.resumes.updateResume(
        auth.context,
        id,
        body as Parameters<typeof config.resumes.updateResume>[2],
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to update resume",
        503,
        requestId,
      );
    }
  });

  // Delete resume by ID
  app.delete("/api/v1/resume/:id", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      const result = config.personalEditorOnly
        ? await config.resumes.removeResume(
            auth.context,
            id,
            await c.req.json().catch(() => {
              throw new ResumeError("invalid_input");
            }),
          )
        : await config.resumes.deleteResume(auth.context, id);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 404,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to delete resume",
        503,
        requestId,
      );
    }
  });

  // Download resume by ID
  app.get("/api/v1/resume/:id/download", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    const formatQuery = c.req.query("format") || "markdown";
    const validFormats = ["json", "markdown", "text", "html"] as const;
    const format = validFormats.includes(
      formatQuery as (typeof validFormats)[number],
    )
      ? (formatQuery as (typeof validFormats)[number])
      : "markdown";

    try {
      const result = await config.resumes.downloadResume(
        auth.context,
        id,
        format,
      );
      c.header("Content-Type", result.mimeType);
      c.header(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );
      return c.body(result.content);
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 404,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to download resume",
        503,
        requestId,
      );
    }
  });

  // List versions for a resume
  app.get("/api/v1/resume/:id/versions", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      const result = await config.resumes.listResumeVersions(auth.context, id);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 404,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to list versions",
        503,
        requestId,
      );
    }
  });

  // Clone a resume
  app.post("/api/v1/resume/:id/clone", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      let title: string | undefined;
      const contentType = c.req.header("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const body = (await c.req.json().catch(() => ({}))) as {
          title?: string;
        };
        title = body.title;
      }
      const result = await config.resumes.cloneResume(auth.context, id, title);
      return c.json({ data: result, requestId }, 201);
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 404,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to clone resume",
        503,
        requestId,
      );
    }
  });

  // List all resumes
  app.get("/api/v1/resume", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    try {
      const result = await config.resumes.listResumes(
        auth.context,
        c.req.query("cursor"),
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 503,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to list resumes",
        503,
        requestId,
      );
    }
  });

  // Tailor resume against a JD (computes ATS score & updates resume)
  app.post("/api/v1/resume/:id/tailor", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      const contentType = c.req.header("Content-Type") ?? "";
      if (!contentType.includes("application/json")) {
        return fail(
          c,
          "unsupported_media_type",
          "Content-Type must be application/json",
          415,
          requestId,
        );
      }
      const body: unknown = await c.req.json();
      const result = await config.resumes.tailorResume(
        auth.context,
        id,
        body as Parameters<typeof config.resumes.tailorResume>[2],
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to tailor resume",
        503,
        requestId,
      );
    }
  });

  // Keyword & skill gap analysis between resume and JD (F17)
  const handleGapAnalysis = async (c: Context) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id") ?? "";
    try {
      let body: unknown = {};
      const contentType = c.req.header("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        body = await c.req.json().catch(() => ({}));
      }
      const result = await config.resumes.analyzeResumeGap(
        auth.context,
        id,
        body as Parameters<typeof config.resumes.analyzeResumeGap>[2],
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to run gap analysis",
        503,
        requestId,
      );
    }
  };

  app.post("/api/v1/resume/:id/gap-analysis", handleGapAnalysis);
  app.get("/api/v1/resume/:id/gap-analysis", handleGapAnalysis);

  // Parse JD text only (preview / no persistence)
  app.post("/api/v1/jd/parse", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    try {
      const contentType = c.req.header("Content-Type") ?? "";
      if (!contentType.includes("application/json")) {
        return fail(
          c,
          "unsupported_media_type",
          "Content-Type must be application/json",
          415,
          requestId,
        );
      }
      const body: unknown = await c.req.json();
      const result = await config.resumes.parseJdOnly(
        body as Parameters<typeof config.resumes.parseJdOnly>[0],
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to parse job description",
        503,
        requestId,
      );
    }
  });

  // Save JD (parse and persist to JDHistory)
  const handleSaveJd = async (c: Context) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    try {
      const contentType = c.req.header("Content-Type") ?? "";
      if (!contentType.includes("application/json")) {
        return fail(
          c,
          "unsupported_media_type",
          "Content-Type must be application/json",
          415,
          requestId,
        );
      }
      const body: unknown = await c.req.json();
      const result = await config.resumes.parseAndSaveJD(
        auth.context,
        body as Parameters<typeof config.resumes.parseAndSaveJD>[1],
      );
      return c.json({ data: result, requestId }, 201);
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to save job description",
        503,
        requestId,
      );
    }
  };

  app.post("/api/v1/jd", handleSaveJd);
  app.post("/api/v1/jd/history", handleSaveJd);

  // List JD histories
  const handleListJd = async (c: Context) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    try {
      const result = await config.resumes.listJDHistories(auth.context);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 503,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to list job descriptions",
        503,
        requestId,
      );
    }
  };

  app.get("/api/v1/jd", handleListJd);
  app.get("/api/v1/jd/history", handleListJd);

  // Get specific JD history by ID
  const handleGetJdById = async (c: Context) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id") ?? "";
    try {
      const result = await config.resumes.getJDHistoryById(auth.context, id);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 404,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to get job description",
        503,
        requestId,
      );
    }
  };

  app.get("/api/v1/jd/:id", handleGetJdById);
  app.get("/api/v1/jd/history/:id", handleGetJdById);

  // Delete specific JD history by ID (F11)
  const handleDeleteJd = async (c: Context) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id") ?? "";
    try {
      const result = await config.resumes.deleteJDHistory(auth.context, id);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 404,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to delete job description",
        503,
        requestId,
      );
    }
  };

  app.delete("/api/v1/jd/:id", handleDeleteJd);
  app.delete("/api/v1/jd/history/:id", handleDeleteJd);

  // Generate a basic or tailored resume from master profile facts
  app.post("/api/v1/resume/generate", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    try {
      let body: unknown = {};
      const contentType = c.req.header("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        body = await c.req.json().catch(() => ({}));
      }
      const result = await config.resumes.generateResumeFromProfile(
        auth.context,
        body as Parameters<typeof config.resumes.generateResumeFromProfile>[1],
      );
      return c.json({ data: result, requestId }, 201);
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to generate resume from profile",
        503,
        requestId,
      );
    }
  });

  // Generate grounded section rewrite suggestion
  app.post("/api/v1/resume/:id/suggest", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      const contentType = c.req.header("Content-Type") ?? "";
      if (!contentType.includes("application/json")) {
        return fail(
          c,
          "unsupported_media_type",
          "Content-Type must be application/json",
          415,
          requestId,
        );
      }
      const body: unknown = await c.req.json();
      const result = await config.resumes.generateSectionSuggestion(
        auth.context,
        id,
        body as Parameters<typeof config.resumes.generateSectionSuggestion>[2],
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to generate suggestion",
        503,
        requestId,
      );
    }
  });

  // Apply suggestion to resume (increments version)
  app.post("/api/v1/resume/:id/apply-suggestion", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      const contentType = c.req.header("Content-Type") ?? "";
      if (!contentType.includes("application/json")) {
        return fail(
          c,
          "unsupported_media_type",
          "Content-Type must be application/json",
          415,
          requestId,
        );
      }
      const body: unknown = await c.req.json();
      const result = await config.resumes.applySectionSuggestion(
        auth.context,
        id,
        body as Parameters<typeof config.resumes.applySectionSuggestion>[2],
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 422,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to apply suggestion",
        503,
        requestId,
      );
    }
  });

  // Get TaskRun status
  app.get("/api/v1/task-run/:id", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const id = c.req.param("id");
    try {
      const result = await config.resumes.getTaskRunById(auth.context, id);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(
          c,
          err.code,
          err.message,
          statusMap[err.code] ?? 404,
          requestId,
        );
      }
      return fail(
        c,
        "resume_unavailable",
        "Failed to get task run",
        503,
        requestId,
      );
    }
  });

  return app;
}
