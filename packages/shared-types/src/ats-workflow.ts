import { z } from "zod";
import { readinessEvaluationSchema } from "./readiness.js";
const version = z.number().int().min(1).max(999999999);
const target = z.union([
  z
    .object({
      type: z.literal("section"),
      sectionId: z.string().min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("entry"),
      sectionId: z.string().min(1).max(100),
      itemId: z.string().min(1).max(100),
    })
    .strict(),
]);
export const jdEvaluationSchema = z
  .object({
    id: z.string().uuid(),
    resumeId: z.string().uuid(),
    resumeVersion: version,
    versionId: z.string().uuid(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    jdHash: z.string().regex(/^[a-f0-9]{64}$/),
    evaluatedAt: z.string().datetime(),
    jdText: z.string().min(50).max(12000),
    mode: z.literal("jd"),
    rubricVersion: z.literal("jd-local-v1"),
    score: z.number().int().min(0).max(100).nullable(),
    partial: z.boolean(),
    components: z
      .array(
        z
          .object({
            id: z.string().max(30),
            label: z.string().max(100),
            weight: z.number().int().min(0).max(100),
            score: z.number().int().min(0).max(100).nullable(),
          })
          .strict(),
      )
      .length(5),
    keywords: z
      .array(
        z.object({ term: z.string().max(100), matched: z.boolean() }).strict(),
      )
      .max(100),
    skills: z
      .array(
        z.object({ term: z.string().max(100), matched: z.boolean() }).strict(),
      )
      .max(100),
    responsibilities: z
      .array(
        z
          .object({
            requirement: z.string().max(1000),
            matched: z.boolean(),
            method: z.enum(["semantic", "term-overlap"]),
            target: target.nullable(),
          })
          .strict(),
      )
      .max(30),
    checks: readinessEvaluationSchema.shape.checks,
    warnings: z.array(z.string().max(700)).max(15),
    retrieval: z
      .object({
        model: z.literal("gemini-embedding-001"),
        dimensions: z.literal(768),
        indexedChunks: z.number().int().min(0).max(40),
        reusedChunks: z.number().int().min(0).max(40),
        hits: z
          .array(
            z
              .object({
                requirement: z.string().max(1000),
                sectionId: z.string().max(100),
                itemId: z.string().max(100),
                similarity: z.number().min(-1).max(1),
              })
              .strict(),
          )
          .max(90),
      })
      .strict()
      .optional(),
    analysis: z.enum(["local", "gemini"]),
    model: z.string().max(100).nullable(),
  })
  .strict();
export const jdStateSchema = z
  .object({
    currentVersion: version,
    evaluation: jdEvaluationSchema.nullable(),
    dismissed: z.array(z.string().max(400)).max(100),
    geminiAvailable: z.boolean(),
  })
  .strict();
export const jdRunSchema = z
  .object({
    expectedVersion: version,
    jdText: z.string().trim().min(50).max(12000),
    semantic: z.boolean().default(false),
    consent: z.boolean().default(false),
  })
  .strict();
export const jdPreferenceSchema = z
  .object({
    expectedVersion: version,
    evaluationId: z.string().uuid(),
    issueId: z.string().max(400),
    dismissed: z.boolean(),
  })
  .strict();
export const rewriteRequestSchema = z
  .object({ expectedVersion: version, target, consent: z.literal(true) })
  .strict();
export const rewriteProposalSchema = z
  .object({
    id: z.string().uuid(),
    resumeId: z.string().uuid(),
    resumeVersion: version,
    versionId: z.string().uuid(),
    target,
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.string().datetime(),
    // Preserve existing immutable proposals while new requests use Gemini.
    model: z.enum(["gemini-3.5-flash-lite", "mimo-v2.6-flash-free"]),
    changes: z
      .array(
        z
          .object({
            field: z.string().min(1).max(200),
            label: z.string().max(200),
            original: z.string().max(10000),
            proposed: z.string().max(10000),
          })
          .strict(),
      )
      .max(30),
    appliedVersion: version.nullable(),
  })
  .strict();
export const rewriteApplySchema = z
  .object({ expectedVersion: version, proposalId: z.string().uuid() })
  .strict();
export type JdEvaluation = z.infer<typeof jdEvaluationSchema>;
export type JdState = z.infer<typeof jdStateSchema>;
export type RewriteProposal = z.infer<typeof rewriteProposalSchema>;
export type RewriteTarget = z.infer<typeof target>;
