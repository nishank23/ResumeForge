import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import {
  INTERNAL_ACTOR_PATH,
  LOCAL_PROFILE_SERVICE_ID,
  localProfileServiceKeySchema,
  actorRequestSchema,
  resolvedActorSchema,
  type ResolvedActor,
} from "@resume-forge/access-policy/server";

export function createActorRoute(config: {
  key?: string;
  resolve: (token: string) => Promise<ResolvedActor | null>;
}) {
  if (
    config.key !== undefined &&
    !localProfileServiceKeySchema.safeParse(config.key).success
  )
    throw new Error("Invalid local actor service configuration");
  const app = new Hono();
  app.post(INTERNAL_ACTOR_PATH, async (c) => {
    if (!config.key)
      return c.json({ error: { code: "auth_unavailable" } }, 503);
    const supplied = /^Bearer ([a-f0-9]{64})$/.exec(
      c.req.header("authorization") ?? "",
    )?.[1];
    if (
      c.req.header("x-resume-forge-service") !== LOCAL_PROFILE_SERVICE_ID ||
      !supplied ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(config.key))
    )
      return c.json({ error: { code: "service_unauthorized" } }, 401);
    if (c.req.header("origin") !== undefined)
      return c.json({ error: { code: "service_forbidden" } }, 403);
    if (
      !/^application\/json(?:\s*;.*)?$/i.test(
        c.req.header("content-type") ?? "",
      )
    )
      return c.json({ error: { code: "invalid_request" } }, 415);
    const reader = c.req.raw.body?.getReader();
    if (!reader) return c.json({ error: { code: "invalid_request" } }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        const value: unknown = result.value;
        if (!(value instanceof Uint8Array))
          return c.json({ error: { code: "invalid_request" } }, 400);
        size += value.byteLength;
        if (size > 512)
          return c.json({ error: { code: "invalid_request" } }, 413);
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    let input: unknown;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return c.json({ error: { code: "invalid_request" } }, 400);
    }
    const parsed = actorRequestSchema.safeParse(input);
    if (!parsed.success)
      return c.json({ error: { code: "invalid_request" } }, 422);
    try {
      const actor = await config.resolve(parsed.data.accessToken);
      if (!actor) return c.json({ error: { code: "unauthenticated" } }, 401);
      const result = resolvedActorSchema.safeParse(actor);
      if (!result.success) throw new Error();
      return c.json({ data: result.data });
    } catch {
      return c.json({ error: { code: "auth_unavailable" } }, 503);
    }
  });
  return app;
}
