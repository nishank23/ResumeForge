import { setTimeout as delay } from "node:timers/promises";
import type { AuditDeliverySummary } from "./audit-delivery.js";

export interface AuditRelayWorkerOptions {
  signal: AbortSignal;
  pollIntervalMs?: number;
  onBatch?: (summary: AuditDeliverySummary) => void;
  // Deliberately no raw exception parameter: telemetry must remain content-free.
  onUnavailable?: () => void;
  wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

/** Immediate first pass; wait AFTER completion so slow batches never overlap. */
export async function runAuditRelayWorker(
  runBatch: () => Promise<AuditDeliverySummary>,
  options: AuditRelayWorkerOptions,
): Promise<void> {
  const interval = options.pollIntervalMs ?? 5_000;
  if (!Number.isInteger(interval) || interval < 1_000 || interval > 60_000)
    throw new RangeError("Invalid audit worker interval");
  const wait =
    options.wait ?? ((ms, signal) => delay(ms, undefined, { signal }));
  while (!options.signal.aborted) {
    try {
      const summary = await runBatch();
      options.onBatch?.(summary);
    } catch {
      options.onUnavailable?.();
    }
    // Graceful shutdown drains the active bounded pass, then claims no new work.
    if (options.signal.aborted) break;
    try {
      await wait(interval, options.signal);
    } catch {
      if (!options.signal.aborted)
        throw new Error("Audit worker timer unavailable");
    }
  }
}
