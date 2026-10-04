import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { ActorResolution } from "@resume-forge/access-policy/server";
import type { createResumeUseCases } from "./resume.js";
import { ResumeError } from "./contracts.js";

export function createResumeApp(config: {
  resolveActor: (authorization: string | undefined) => Promise<ActorResolution>;
  resumes: ReturnType<typeof createResumeUseCases>;
}) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    await next();
  });

  const localCors = cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "X-Workspace-Id"],
  });

  app.use("/api/v1/resume/*", localCors);
  app.use("/api/v1/resume", localCors);

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
    status: 400 | 401 | 403 | 404 | 413 | 415 | 422 | 503,
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

  // Parse-only endpoint (can be public or authenticated)
  app.post("/api/v1/resume/parse", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    try {
      let body: unknown;
      const contentType = c.req.header("Content-Type") ?? "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await c.req.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string") {
          return fail(c, "invalid_input", "File is required in form-data", 422, requestId);
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

      const result = await config.resumes.parseResumeOnly(
        body as Parameters<typeof config.resumes.parseResumeOnly>[0],
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        const statusMap: Record<string, 400 | 401 | 403 | 404 | 413 | 415 | 422 | 503> = {
          invalid_input: 422,
          file_too_large: 413,
          unsupported_media_type: 415,
          unauthenticated: 401,
          forbidden: 403,
          not_found: 404,
          resume_unavailable: 503,
        };
        return fail(c, err.code, err.message, statusMap[err.code] ?? 422, requestId);
      }
      return fail(c, "resume_unavailable", "Failed to parse resume", 503, requestId);
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
          return fail(c, "invalid_input", "File is required in form-data", 422, requestId);
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
          ...(templateId && typeof templateId === "string" ? { templateId } : {}),
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
      console.error("DEBUG IMPORT ERROR:", err);
      if (err instanceof ResumeError) {
        const statusMap: Record<string, 400 | 401 | 403 | 404 | 413 | 415 | 422 | 503> = {
          invalid_input: 422,
          file_too_large: 413,
          unsupported_media_type: 415,
          unauthenticated: 401,
          forbidden: 403,
          not_found: 404,
          resume_unavailable: 503,
        };
        return fail(c, err.code, err.message, statusMap[err.code] ?? 422, requestId);
      }
      return fail(c, "resume_unavailable", "Failed to import resume", 503, requestId);
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
        const statusMap: Record<string, 400 | 401 | 403 | 404 | 413 | 415 | 422 | 503> = {
          invalid_input: 422,
          file_too_large: 413,
          unsupported_media_type: 415,
          unauthenticated: 401,
          forbidden: 403,
          not_found: 404,
          resume_unavailable: 503,
        };
        return fail(c, err.code, err.message, statusMap[err.code] ?? 404, requestId);
      }
      return fail(c, "resume_unavailable", "Failed to retrieve resume", 503, requestId);
    }
  });

  // List all resumes
  app.get("/api/v1/resume", async (c) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);

    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    try {
      const result = await config.resumes.listResumes(auth.context);
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof ResumeError) {
        return fail(c, err.code, err.message, 503, requestId);
      }
      return fail(c, "resume_unavailable", "Failed to list resumes", 503, requestId);
    }
  });

  return app;
}
