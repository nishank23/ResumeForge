import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { ActorResolution } from "@resume-forge/access-policy/server";
import type { createProfileUseCases } from "./profile.js";
import { ProfileError } from "./contracts.js";

export function createProfileApp(config: {
  resolveActor: (authorization: string | undefined) => Promise<ActorResolution>;
  profiles: ReturnType<typeof createProfileUseCases>;
}) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    await next();
  });
  const localCors = cors({
    origin: "http://localhost:3000",
    allowMethods: ["GET", "POST", "PUT"],
    allowHeaders: ["Authorization", "Content-Type", "X-Workspace-Id"],
  });
  app.use("/api/v1/profile", localCors);
  app.use("/api/v1/profile/draft", localCors);
  app.use("/api/v1/profile/experience", localCors);
  app.use("/api/v1/profile/experience/:id", localCors);
  app.use("/api/v1/profile/education", localCors);
  app.use("/api/v1/profile/education/:id", localCors);
  app.use("/api/v1/profile/skills", localCors);
  app.use("/api/v1/profile/skills/:id", localCors);
  app.use("/api/v1/profile/projects", localCors);
  app.use("/api/v1/profile/projects/:id", localCors);
  app.onError((_error, c) =>
    c.json(
      {
        error: {
          code: "profile_unavailable",
          message: "Profile service is temporarily unavailable.",
        },
      },
      503,
    ),
  );
  const handler = async (c: Context) => {
    const requestId = randomUUID();
    c.header("X-Request-Id", requestId);
    const fail = (
      code: string,
      status: 400 | 401 | 403 | 404 | 408 | 409 | 413 | 415 | 422 | 503,
    ) =>
      c.json(
        {
          error: { code, message: "Profile request could not be completed." },
          requestId,
        },
        status,
      );
    try {
      const resolution = await config.resolveActor(
        c.req.header("Authorization"),
      );
      if (resolution.status !== "authenticated")
        return fail(
          resolution.status === "unauthenticated"
            ? "unauthenticated"
            : "profile_unavailable",
          resolution.status === "unauthenticated" ? 401 : 503,
        );
      if (Object.keys(c.req.query()).length) return fail("invalid_input", 422);
      const context = {
        actor: resolution.actor,
        selectedWorkspaceId: c.req.header("X-Workspace-Id"),
        correlationId: requestId,
      };
      const experience = c.req.path === "/api/v1/profile/experience";
      const education = c.req.path === "/api/v1/profile/education";
      const skills = c.req.path === "/api/v1/profile/skills";
      const projects = c.req.path === "/api/v1/profile/projects";
      if (c.req.method === "GET")
        return c.json({
          data: await (experience
            ? config.profiles.listExperience(context)
            : education
              ? config.profiles.listEducation(context)
              : skills
                ? config.profiles.listSkills(context)
                : projects
                  ? config.profiles.listProjects(context)
                  : config.profiles.read(context)),
          requestId,
        });
      if (
        c.req.header("Origin") &&
        c.req.header("Origin") !== "http://localhost:3000"
      )
        return fail("forbidden", 403);
      if (
        !/^application\/json(?:\s*;.*)?$/i.test(
          c.req.header("Content-Type") ?? "",
        )
      )
        return fail("invalid_input", 415);
      const reader = c.req.raw.body?.getReader();
      if (!reader) return fail("invalid_input", 400);
      let size = 0;
      const bodyState = { timedOut: false };
      const chunks: Uint8Array[] = [];
      const timer = setTimeout(() => {
        bodyState.timedOut = true;
        void reader.cancel().catch(() => undefined);
      }, 3_000);
      try {
        for (;;) {
          const result = await reader.read();
          if (result.done) break;
          const value: unknown = result.value;
          if (!(value instanceof Uint8Array)) return fail("invalid_input", 400);
          size += value.byteLength;
          if (size > 32_768) return fail("invalid_input", 413);
          chunks.push(value);
        }
      } finally {
        clearTimeout(timer);
        await reader.cancel().catch(() => undefined);
      }
      if (bodyState.timedOut) return fail("invalid_input", 408);
      let input: unknown;
      try {
        input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return fail("invalid_input", 400);
      }
      const creating = c.req.method === "POST";
      const entryId = c.req.param("id");
      const isExperienceEntry =
        entryId !== undefined &&
        c.req.path.startsWith("/api/v1/profile/experience/");
      const isEducationEntry =
        entryId !== undefined &&
        c.req.path.startsWith("/api/v1/profile/education/");
      const isSkillEntry =
        entryId !== undefined &&
        c.req.path.startsWith("/api/v1/profile/skills/");
      const isProjectEntry =
        entryId !== undefined &&
        c.req.path.startsWith("/api/v1/profile/projects/");

      return c.json(
        {
          data: await (creating
            ? experience
              ? config.profiles.addExperience(context, input)
              : education
                ? config.profiles.addEducation(context, input)
                : skills
                  ? config.profiles.addSkill(context, input)
                  : projects
                    ? config.profiles.addProject(context, input)
                    : config.profiles.create(context, input)
            : isExperienceEntry
              ? config.profiles.updateExperience(context, entryId, input)
              : isEducationEntry
                ? config.profiles.updateEducation(context, entryId, input)
                : isSkillEntry
                  ? config.profiles.updateSkill(context, entryId, input)
                  : isProjectEntry
                    ? config.profiles.updateProject(context, entryId, input)
                    : c.req.path === "/api/v1/profile/draft"
                      ? config.profiles.saveDraft(context, input)
                      : config.profiles.update(context, input)),
          requestId,
        },
        creating ? 201 : 200,
      );
    } catch (error) {
      if (error instanceof ProfileError) {
        const statuses = {
          unauthenticated: 401,
          forbidden: 403,
          not_found: 404,
          revision_conflict: 409,
          profile_exists: 409,
          onboarding_complete: 409,
          section_limit: 409,
          invalid_input: 422,
        } as const;
        return fail(error.code, statuses[error.code]);
      }
      return fail("profile_unavailable", 503);
    }
  };
  app.get("/api/v1/profile", handler);
  app.post("/api/v1/profile", handler);
  app.put("/api/v1/profile", handler);
  app.put("/api/v1/profile/draft", handler);
  app.get("/api/v1/profile/experience", handler);
  app.post("/api/v1/profile/experience", handler);
  app.put("/api/v1/profile/experience/:id", handler);
  app.get("/api/v1/profile/education", handler);
  app.post("/api/v1/profile/education", handler);
  app.put("/api/v1/profile/education/:id", handler);
  app.get("/api/v1/profile/skills", handler);
  app.post("/api/v1/profile/skills", handler);
  app.put("/api/v1/profile/skills/:id", handler);
  app.get("/api/v1/profile/projects", handler);
  app.post("/api/v1/profile/projects", handler);
  app.put("/api/v1/profile/projects/:id", handler);
  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: "Route not found." } }, 404),
  );
  return app;
}
