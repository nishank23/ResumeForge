import { z } from "zod";
import { type AuditEventIntent } from "@resume-forge/audit-contracts";
import { AuditDeliveryRejection } from "./audit-delivery.js";

export const LOCAL_AUDIT_SERVICE_ID = "local-audit-relay";
export const INTERNAL_AUDIT_PATH = "/internal/audit/events";
export const localAuditRelayKeySchema = z.string().regex(/^[0-9a-f]{64}$/);

const acknowledgement = z
  .object({
    data: z
      .object({ eventId: z.string().uuid(), duplicate: z.boolean() })
      .strict(),
  })
  .strict();
const rejection = z
  .object({
    error: z
      .object({
        code: z.enum(["invalid_intent", "invalid_scope", "event_conflict"]),
      })
      .strict(),
  })
  .strict();

/** Local-only service adapter. Production service identity/HTTPS remain gated. */
export function createLocalAuditHttpTransport(config: {
  endpoint: string;
  key: string;
  timeoutMs?: number;
}): (intent: AuditEventIntent) => Promise<void> {
  const url = new URL(config.endpoint);
  const timeoutMs = config.timeoutMs ?? 3_000;
  if (
    !localAuditRelayKeySchema.safeParse(config.key).success ||
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== INTERNAL_AUDIT_PATH ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 50 ||
    timeoutMs > 5_000
  )
    throw new Error("Invalid local audit transport configuration");

  return async (intent) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.key}`,
          "x-resume-forge-service": LOCAL_AUDIT_SERVICE_ID,
        },
        body: JSON.stringify(intent),
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Bound the acknowledgement too; never log or persist a peer's raw error.
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1_024) throw new Error();
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (response.status === 200) {
        const parsed = acknowledgement.safeParse(body);
        if (
          !parsed.success ||
          parsed.data.data.eventId !== intent.eventId.toLowerCase()
        )
          throw new Error();
        return;
      }
      const parsed = rejection.safeParse(body);
      if (parsed.success) {
        const code = parsed.data.error.code;
        if (
          (code === "event_conflict" && response.status === 409) ||
          (code === "invalid_scope" && response.status === 422) ||
          (code === "invalid_intent" &&
            [400, 413, 415, 422].includes(response.status))
        )
          throw new AuditDeliveryRejection(code);
      }
      throw new Error();
    } catch (error: unknown) {
      if (error instanceof AuditDeliveryRejection) throw error;
      throw new Error("Audit delivery unavailable");
    }
  };
}
