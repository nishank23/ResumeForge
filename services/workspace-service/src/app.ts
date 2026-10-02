import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
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
  db: ReturnType<typeof createDatabaseClient>;
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
