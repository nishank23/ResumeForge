import { z } from "zod";
const target = z.union([
  z.object({ type: z.literal("header") }).strict(),
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
const componentId = z.enum([
  "structure",
  "detail",
  "skills",
  "clarity",
  "dates",
]);
const boundedScore = z.number().int().min(0).max(100);
export const readinessEvaluationSchema = z
  .object({
    id: z.string().uuid(),
    resumeId: z.string().uuid(),
    resumeVersion: z.number().int().min(1),
    versionId: z.string().uuid(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    evaluatedAt: z.string().datetime(),
    mode: z.literal("general"),
    rubricVersion: z.enum(["readiness-v1", "readiness-v2"]),
    score: boundedScore,
    components: z
      .array(
        z
          .object({
            id: componentId,
            label: z.string().max(100),
            weight: boundedScore,
            score: boundedScore,
            passed: z.number().int().min(0),
            total: z.number().int().min(0),
          })
          .strict(),
      )
      .length(5),
    checks: z
      .array(
        z
          .object({
            id: z.string().max(400),
            componentId,
            title: z.string().max(200),
            reason: z.string().max(700),
            passed: z.boolean(),
            target: target.nullable(),
            scored: z.literal(false).optional(),
          })
          .strict(),
      )
      .max(100),
    truncated: z.boolean(),
  })
  .strict();
export const readinessStateSchema = z
  .object({
    currentVersion: z.number().int().min(1),
    evaluation: readinessEvaluationSchema.nullable(),
    previous: readinessEvaluationSchema.nullable(),
    dismissed: z.array(z.string().max(400)).max(100),
  })
  .strict();
export type ReadinessEvaluation = z.infer<typeof readinessEvaluationSchema>;
export type ReadinessState = z.infer<typeof readinessStateSchema>;
export type ReadinessTarget = z.infer<typeof target>;
export const readinessRequestSchema = z
  .object({ expectedVersion: z.number().int().min(1).max(999999999) })
  .strict();
export const readinessPreferenceSchema = readinessRequestSchema
  .extend({
    evaluationId: z.string().uuid(),
    issueId: z.string().max(400),
    dismissed: z.boolean(),
  })
  .strict();
