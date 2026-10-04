import { z } from "zod";

export const gapMatchTypeSchema = z.enum(["exact", "synonym", "semantic"]);
export type GapMatchType = z.infer<typeof gapMatchTypeSchema>;

export const gapMatchCategorySchema = z.enum([
  "matched",
  "supported_missing",
  "unsupported_missing",
]);
export type GapMatchCategory = z.infer<typeof gapMatchCategorySchema>;

export const gapMatchedItemSchema = z
  .object({
    keyword: z.string().trim().min(1),
    category: z.string(),
    required: z.boolean(),
    matchType: gapMatchTypeSchema,
    matchedText: z.string(),
    resumeSection: z.enum([
      "summary",
      "experience",
      "skills",
      "projects",
      "education",
      "certifications",
    ]),
    resumeEntryTitle: z.string().optional(),
    explanation: z.string(),
  })
  .strict();

export type GapMatchedItemDto = z.infer<typeof gapMatchedItemSchema>;

export const gapSupportedMissingItemSchema = z
  .object({
    keyword: z.string().trim().min(1),
    category: z.string(),
    required: z.boolean(),
    supportingSourceSection: z.enum([
      "skills",
      "experience",
      "projects",
      "education",
      "certifications",
      "profile",
    ]),
    supportingEvidence: z.string(),
    profileRevision: z.number().int().nonnegative(),
    suggestedTargetSection: z.enum(["skills", "experience", "summary", "projects"]),
    suggestedAction: z.string(),
    explanation: z.string(),
  })
  .strict();

export type GapSupportedMissingItemDto = z.infer<
  typeof gapSupportedMissingItemSchema
>;

export const gapUnsupportedMissingItemSchema = z
  .object({
    keyword: z.string().trim().min(1),
    category: z.string(),
    required: z.boolean(),
    jdContext: z.string().optional(),
    advice: z.string(),
    explanation: z.string(),
  })
  .strict();

export type GapUnsupportedMissingItemDto = z.infer<
  typeof gapUnsupportedMissingItemSchema
>;

export const gapAnalysisResultSchema = z
  .object({
    resumeId: z.string().uuid(),
    resumeTitle: z.string(),
    resumeVersion: z.number().int().positive(),
    profileRevision: z.number().int().nonnegative(),
    jdHistoryId: z.string().uuid().nullable(),
    jobTitle: z.string().nullable(),
    company: z.string().nullable(),
    matchPercentage: z.number().min(0).max(100),
    totalKeywordsCount: z.number().int().nonnegative(),
    matchedCount: z.number().int().nonnegative(),
    supportedMissingCount: z.number().int().nonnegative(),
    unsupportedMissingCount: z.number().int().nonnegative(),
    requiredMissingCount: z.number().int().nonnegative(),
    matched: z.array(gapMatchedItemSchema),
    supportedMissing: z.array(gapSupportedMissingItemSchema),
    unsupportedMissing: z.array(gapUnsupportedMissingItemSchema),
    model: z.string(),
    semanticEngineStatus: z.enum(["active", "fallback_exact_synonyms"]),
    analyzedAt: z.string(),
  })
  .strict();

export type GapAnalysisResultDto = z.infer<typeof gapAnalysisResultSchema>;

export const gapAnalysisRequestSchema = z
  .object({
    jdHistoryId: z.string().uuid().optional(),
    rawJD: z
      .string()
      .trim()
      .min(20, "Job description must be at least 20 characters")
      .max(50_000, "Job description exceeds 50,000 characters")
      .optional(),
  })
  .strict();

export type GapAnalysisRequest = z.infer<typeof gapAnalysisRequestSchema>;
