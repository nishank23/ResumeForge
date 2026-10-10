import { z } from "zod";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const providerId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
/** Stable consumer contract. Remote document IDs, contacts, credentials and raw responses are private. */
export const jdMatchIdentitySchema = z.object({
  resumeId: z.string().uuid(),
  resumeVersion: z.number().int().min(1).max(999999999),
  versionId: z.string().uuid(),
  resumeInputHash: hash,
  jdInputHash: hash,
}).strict();
export const jdMatchFailureCodeSchema = z.enum([
  "not_configured", "invalid_configuration", "unsupported_provider", "invalid_input",
  "quota_exceeded", "rate_limited", "timeout", "unavailable", "invalid_response", "not_scored",
]);
export const jdMatchOutcomeSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("scored"),
    contractVersion: z.literal("jd-match-v1"),
    mode: z.literal("jd-match"),
    identity: jdMatchIdentitySchema,
    evaluatedAt: z.string().datetime(),
    score: z.number().finite().min(0).max(100),
    source: z.object({
      provider: providerId,
      method: z.string().min(1).max(100),
      apiVersion: z.string().min(1).max(100),
      engineVersion: z.string().min(1).max(100).nullable(),
      nativeScore: z.number().finite().min(0).max(100),
      nativeScale: z.union([z.literal(1), z.literal(100)]),
      normalization: z.literal("linear-scale-v1"),
    }).strict(),
    // Counts of vendor query criteria, not our proposed five-component rubric or factual verification.
    criteria: z.object({
      matched: z.number().int().min(0).max(500),
      unmatched: z.number().int().min(0).max(500),
      unknown: z.number().int().min(0).max(500),
    }).strict().nullable(),
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    contractVersion: z.literal("jd-match-v1"),
    mode: z.literal("jd-match"),
    code: jdMatchFailureCodeSchema,
  }).strict(),
]).refine((result) => result.status !== "scored" || (
  result.source.nativeScore <= result.source.nativeScale &&
  result.score === Math.round(result.source.nativeScore / result.source.nativeScale * 1000) / 10 &&
  (!result.criteria || result.criteria.matched + result.criteria.unmatched + result.criteria.unknown <= 500)
));
export type JdMatchIdentity = z.infer<typeof jdMatchIdentitySchema>;
export type JdMatchOutcome = z.infer<typeof jdMatchOutcomeSchema>;
export type JdMatchFailureCode = z.infer<typeof jdMatchFailureCodeSchema>;
