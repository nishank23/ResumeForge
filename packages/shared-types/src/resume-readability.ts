import { z } from "zod";

// Bump when the renderer, extraction or comparison semantics change.
export const PDF_READABILITY_ENGINE = "pdf-readability-v1" as const;
export const readabilityRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const readabilityAnalysisSchema = z
  .object({
    engineVersion: z.literal(PDF_READABILITY_ENGINE),
    status: z.enum(["readable", "needs_review"]),
    checkedBlocks: z.number().int().min(0).max(1200),
    recoveredBlocks: z.number().int().min(0).max(1200),
    pages: z
      .array(
        z
          .object({
            page: z.number().int().min(1).max(30),
            text: z.string().max(200000),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    issues: z
      .array(
        z
          .object({
            kind: z.enum(["missing_text", "reading_order", "no_text"]),
            label: z.string().min(1).max(200),
            sectionId: z.string().min(1).max(100).optional(),
            affectedBlocks: z.number().int().min(1).max(1200),
            excerpts: z.array(z.string().min(1).max(240)).max(3),
          })
          .strict(),
      )
      .max(64),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.recoveredBlocks > value.checkedBlocks ||
      value.pages.some((page, i) => page.page !== i + 1) ||
      value.pages.reduce((n, page) => n + page.text.length, 0) > 200000 ||
      (value.status === "readable" &&
        (!value.checkedBlocks ||
          value.issues.length ||
          value.recoveredBlocks !== value.checkedBlocks)) ||
      (value.status === "needs_review" && !value.issues.length)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inconsistent PDF readability result.",
      });
  });
export const readabilityEvaluationSchema = z
  .object({
    resumeId: z.string().uuid(),
    versionId: z.string().uuid(),
    resumeVersion: z.number().int().positive(),
    documentHash: z.string().regex(/^[a-f0-9]{64}$/),
    checkedAt: z.string().datetime(),
    analysis: readabilityAnalysisSchema,
  })
  .strict();
export const readabilityStateSchema = z
  .object({
    currentVersion: z.number().int().positive(),
    evaluation: readabilityEvaluationSchema.nullable(),
  })
  .strict();
export type ReadabilityAnalysis = z.infer<typeof readabilityAnalysisSchema>;
export type ReadabilityState = z.infer<typeof readabilityStateSchema>;
