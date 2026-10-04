import { timingSafeEqual, randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { validateAuditEventIntent } from "@resume-forge/audit-contracts";
import {
  AuditDeliveryRejection,
  INTERNAL_AUDIT_PATH,
  LOCAL_AUDIT_SERVICE_ID,
  localAuditRelayKeySchema,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import { ingestPersonalAuditEvent } from "./audit.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberSchema,
  createGrantSchema,
  auditEventsQuerySchema,
  WorkspaceError,
  type ResolvedActor,
} from "./contracts.js";
import { createWorkspaceUseCases } from "./workspace.js";

type Database = ReturnType<typeof createDatabaseClient>;

// Reject unknown top-level fields before the existing contract normalizes input.
const intentSchema = z
  .object({
    eventId: z.string(),
    action: z.string(),
    actorUserId: z.string(),
    targetUserId: z.string().optional(),
    workspaceType: z.string(),
    workspaceId: z.string(),
    resourceType: z.string(),
    resourceId: z.string(),
    outcome: z.string(),
    occurredAt: z.string(),
    correlationId: z.string(),
    metadata: z.unknown().optional(),
  })
  .strict()
  .transform((input, ctx) => {
    const result = validateAuditEventIntent(input);
    if (result.success) return result.data;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid audit intent",
    });
    return z.NEVER;
  });

export function createWorkspaceAuditApp(config: {
  db: Database;
  relayKey: string;
}) {
  if (!localAuditRelayKeySchema.safeParse(config.relayKey).success)
    throw new Error("Invalid local audit service configuration");
  const key = config.relayKey;
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
  app.post(INTERNAL_AUDIT_PATH, async (c) => {
    const supplied =
      /^Bearer ([0-9a-f]{64})$/.exec(
        c.req.header("authorization") ?? "",
      )?.[1] ?? "";
    if (
      c.req.header("x-resume-forge-service") !== LOCAL_AUDIT_SERVICE_ID ||
      !localAuditRelayKeySchema.safeParse(supplied).success ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(key))
    )
      return c.json({ error: { code: "service_unauthorized" } }, 401);
    // This route is server-only, without CORS. Reject browser-origin requests.
    if (c.req.header("origin") !== undefined)
      return c.json({ error: { code: "service_forbidden" } }, 403);
    if (
      !/^application\/json(?:\s*;.*)?$/i.test(
        c.req.header("content-type") ?? "",
      )
    )
      return c.json({ error: { code: "invalid_intent" } }, 415);
    const reader = c.req.raw.body?.getReader();
    if (!reader) return c.json({ error: { code: "invalid_intent" } }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16_384)
          return c.json({ error: { code: "invalid_intent" } }, 413);
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    let input: unknown;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return c.json({ error: { code: "invalid_intent" } }, 400);
    }
    const parsed = intentSchema.safeParse(input);
    if (!parsed.success)
      return c.json({ error: { code: "invalid_intent" } }, 422);
    try {
      // Acknowledgement is emitted only after the ledger transaction COMMIT.
      const data = await ingestPersonalAuditEvent(config.db, parsed.data);
      return c.json({ data });
    } catch (error: unknown) {
      if (error instanceof AuditDeliveryRejection)
        return c.json(
          { error: { code: error.code } },
          error.code === "event_conflict" ? 409 : 422,
        );
      return c.json({ error: { code: "delivery_unavailable" } }, 503);
    }
  });
  app.notFound((c) => c.json({ error: { code: "not_found" } }, 404));
  app.onError((_error, c) =>
    c.json({ error: { code: "delivery_unavailable" } }, 503),
  );
  return app;
}

export type ActorResolution =
  | { status: "authenticated"; actor: ResolvedActor }
  | { status: "unauthenticated" | "unavailable"; actor?: never };

export function createWorkspaceApp(config: {
  db: Database;
  resolveActor: (authorization: string | undefined) => Promise<ActorResolution>;
  relayKey?: string;
  useCases?: ReturnType<typeof createWorkspaceUseCases>;
}) {
  const app = new Hono();
  const workspaces = config.useCases ?? createWorkspaceUseCases(config.db);

  const localCors = cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "X-Workspace-Id", "X-Request-Id"],
  });

  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });

  app.use("/api/v1/*", localCors);

  const fail = (
    c: Context,
    code: string,
    message: string,
    status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503,
    requestId: string,
  ) =>
    c.json(
      {
        error: { code, message },
        requestId,
      },
      status as any,
    );

  async function authenticate(c: Context, requestId: string) {
    const resolution = await config.resolveActor(c.req.header("Authorization"));
    if (resolution.status !== "authenticated") {
      return {
        authenticated: false as const,
        response: fail(
          c,
          resolution.status === "unauthenticated"
            ? "unauthenticated"
            : "workspace_unavailable",
          "Authentication failed.",
          resolution.status === "unauthenticated" ? 401 : 503,
          requestId,
        ),
      };
    }
    return {
      authenticated: true as const,
      actor: resolution.actor,
    };
  }

  // Health check
  app.get("/api/v1/health", (c) => {
    return c.json({
      data: {
        status: "ok",
        service: "workspace-service",
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ── 1. Create Workspace (Org / Vendor) ──────────────────────────────────
  app.post("/api/v1/workspaces", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return fail(c, "invalid_json", "Invalid JSON payload", 400, requestId);
    }

    const parsed = createWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        "validation_error",
        parsed.error.errors[0]?.message ?? "Invalid input",
        422,
        requestId,
      );
    }

    try {
      const workspace = await workspaces.createWorkspace(auth.actor, parsed.data, requestId);
      return c.json({ data: workspace, requestId }, 201);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to create workspace", 500, requestId);
    }
  });

  // ── 2. List Workspaces for Actor ────────────────────────────────────────
  app.get("/api/v1/workspaces", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    try {
      const list = await workspaces.listWorkspaces(auth.actor);
      return c.json({ data: list, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to list workspaces", 500, requestId);
    }
  });

  // ── 3. Get Workspace Details ───────────────────────────────────────────
  app.get("/api/v1/workspaces/:id", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    try {
      const ws = await workspaces.getWorkspace(auth.actor, workspaceId);
      return c.json({ data: ws, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to get workspace", 500, requestId);
    }
  });

  // ── 4. Update Workspace Settings ───────────────────────────────────────
  app.patch("/api/v1/workspaces/:id", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return fail(c, "invalid_json", "Invalid JSON payload", 400, requestId);
    }

    const parsed = updateWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        "validation_error",
        parsed.error.errors[0]?.message ?? "Invalid input",
        422,
        requestId,
      );
    }

    try {
      const updated = await workspaces.updateWorkspace(
        auth.actor,
        workspaceId,
        parsed.data,
        requestId,
      );
      return c.json({ data: updated, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to update workspace", 500, requestId);
    }
  });

  // ── 5. Switch / Context Endpoint ───────────────────────────────────────
  const getContextHandler = async (c: Context) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id") ?? "";
    try {
      const context = await workspaces.switchContext(auth.actor, workspaceId);
      return c.json({ data: context, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to resolve workspace context", 500, requestId);
    }
  };

  app.get("/api/v1/workspaces/:id/context", getContextHandler);
  app.post("/api/v1/workspaces/:id/switch", getContextHandler);

  // ── 6. List Members ────────────────────────────────────────────────────
  app.get("/api/v1/workspaces/:id/members", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    try {
      const members = await workspaces.listMembers(auth.actor, workspaceId);
      return c.json({ data: members, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to list members", 500, requestId);
    }
  });

  // ── 7. Invite / Add Member ─────────────────────────────────────────────
  app.post("/api/v1/workspaces/:id/members", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return fail(c, "invalid_json", "Invalid JSON payload", 400, requestId);
    }

    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        "validation_error",
        parsed.error.errors[0]?.message ?? "Invalid input",
        422,
        requestId,
      );
    }

    try {
      const member = await workspaces.inviteMember(
        auth.actor,
        workspaceId,
        parsed.data,
        requestId,
      );
      return c.json({ data: member, requestId }, 201);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to invite member", 500, requestId);
    }
  });

  // ── 8. Update Member Role / Status (with last-owner protection) ─────────
  app.patch("/api/v1/workspaces/:id/members/:memberId", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    const memberId = c.req.param("memberId");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return fail(c, "invalid_json", "Invalid JSON payload", 400, requestId);
    }

    const parsed = updateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        "validation_error",
        parsed.error.errors[0]?.message ?? "Invalid input",
        422,
        requestId,
      );
    }

    try {
      const updated = await workspaces.updateMember(
        auth.actor,
        workspaceId,
        memberId,
        parsed.data,
        requestId,
      );
      return c.json({ data: updated, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to update member", 500, requestId);
    }
  });

  // ── 9. Remove Member (with last-owner protection) ───────────────────────
  app.delete("/api/v1/workspaces/:id/members/:memberId", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    const memberId = c.req.param("memberId");

    try {
      const result = await workspaces.removeMember(
        auth.actor,
        workspaceId,
        memberId,
        requestId,
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to remove member", 500, requestId);
    }
  });

  // ── 10. Profile-Workspace Grants (D03) ──────────────────────────────────
  app.post("/api/v1/workspaces/:id/grants", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return fail(c, "invalid_json", "Invalid JSON payload", 400, requestId);
    }

    const parsed = createGrantSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        c,
        "validation_error",
        parsed.error.errors[0]?.message ?? "Invalid input",
        422,
        requestId,
      );
    }

    try {
      const grant = await workspaces.createGrant(
        auth.actor,
        workspaceId,
        parsed.data,
        requestId,
      );
      return c.json({ data: grant, requestId }, 201);
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to create grant", 500, requestId);
    }
  });

  app.get("/api/v1/workspaces/:id/grants", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    try {
      const grants = await workspaces.listGrants(auth.actor, workspaceId);
      return c.json({ data: grants, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to list grants", 500, requestId);
    }
  });

  app.delete("/api/v1/workspaces/:id/grants/:grantId", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    const grantId = c.req.param("grantId");
    try {
      const result = await workspaces.revokeGrant(
        auth.actor,
        workspaceId,
        grantId,
        requestId,
      );
      return c.json({ data: result, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to revoke grant", 500, requestId);
    }
  });

  // ── 11. Audit Events Viewer (F15) ──────────────────────────────────────
  app.get("/api/v1/workspaces/:id/audit-events", async (c) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    const auth = await authenticate(c, requestId);
    if (!auth.authenticated) return auth.response;

    const workspaceId = c.req.param("id");
    const parsedQuery = auditEventsQuerySchema.safeParse(c.req.query());
    if (!parsedQuery.success) {
      return fail(
        c,
        "validation_error",
        parsedQuery.error.errors[0]?.message ?? "Invalid query parameters",
        422,
        requestId,
      );
    }

    try {
      const events = await workspaces.listAuditEvents(
        auth.actor,
        workspaceId,
        parsedQuery.data,
      );
      return c.json({ data: events, requestId });
    } catch (err: unknown) {
      if (err instanceof WorkspaceError) {
        return fail(c, err.code, err.message, err.status as any, requestId);
      }
      return fail(c, "workspace_error", "Failed to list audit events", 500, requestId);
    }
  });

  // Mount internal audit app if relayKey provided
  if (config.relayKey) {
    const auditApp = createWorkspaceAuditApp({
      db: config.db,
      relayKey: config.relayKey,
    });
    app.route("", auditApp);
  }

  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: "Route not found" } }, 404),
  );

  return app;
}
