import { z } from "zod";
import { runtimeAppOrigin } from "./runtime.js";
export { runtimeAppOrigin } from "./runtime.js";

// Server-only entrypoint. Never expose a service credential through federation.
export const INTERNAL_ACTOR_PATH = "/internal/auth/resolve";
export const LOCAL_PROFILE_SERVICE_ID = "local-profile-service";
export const localProfileServiceKeySchema = z.string().regex(/^[a-f0-9]{64}$/);
export const actorRequestSchema = z
  .object({ accessToken: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const resolvedActorSchema = z
  .object({
    userId: z.string().uuid(),
    personalWorkspaceId: z.string().uuid(),
    expiresAt: z.number().int().positive(),
  })
  .strict();
export type ResolvedActor = z.infer<typeof resolvedActorSchema>;
export type ActorResolution =
  | { status: "authenticated"; actor: ResolvedActor }
  | { status: "unauthenticated" | "unavailable"; actor?: never };
const successSchema = z.object({ data: resolvedActorSchema }).strict();
const unauthorizedSchema = z
  .object({ error: z.object({ code: z.literal("unauthenticated") }).strict() })
  .strict();

/** Resolve every request afresh. This establishes identity, never action/resource authority. */
export function createLocalActorResolver(config: {
  endpoint: string;
  key: string;
  timeoutMs?: number;
  now?: () => number;
}): (authorization: string | undefined) => Promise<ActorResolution> {
  let url: URL;
  try {
    runtimeAppOrigin();
    url = new URL(config.endpoint);
  } catch {
    throw new Error("Invalid local actor resolver configuration");
  }
  const timeout = config.timeoutMs ?? 3_000;
  if (
    !localProfileServiceKeySchema.safeParse(config.key).success ||
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== INTERNAL_ACTOR_PATH ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    !Number.isInteger(timeout) ||
    timeout < 50 ||
    timeout > 5_000
  )
    throw new Error("Invalid local actor resolver configuration");
  const now = config.now ?? Date.now;
  return async (authorization) => {
    const token = /^Bearer ([a-f0-9]{64})$/.exec(authorization ?? "")?.[1];
    if (!token) return { status: "unauthenticated" };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.key}`,
          "x-resume-forge-service": LOCAL_PROFILE_SERVICE_ID,
        },
        body: JSON.stringify({ accessToken: token }),
        redirect: "error",
        signal: AbortSignal.timeout(timeout),
      });
      const reader = response.body?.getReader();
      if (!reader) return { status: "unavailable" };
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        for (;;) {
          const result = await reader.read();
          if (result.done) break;
          const value: unknown = result.value;
          if (!(value instanceof Uint8Array)) return { status: "unavailable" };
          size += value.byteLength;
          if (size > 512) return { status: "unavailable" };
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (
        response.status === 401 &&
        unauthorizedSchema.safeParse(input).success
      )
        return { status: "unauthenticated" };
      const parsed = successSchema.safeParse(input);
      const time = now();
      if (
        response.status !== 200 ||
        !parsed.success ||
        !Number.isFinite(time) ||
        parsed.data.data.expiresAt <= time ||
        parsed.data.data.expiresAt > time + 300_000
      )
        return { status: "unavailable" };
      return { status: "authenticated", actor: parsed.data.data };
    } catch {
      return { status: "unavailable" };
    }
  };
}
