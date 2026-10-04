import { z } from "zod";

export const resumeGenerateRequestSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    templateId: z.string().trim().max(100).default("default"),
    jdHistoryId: z.string().uuid().optional(),
  })
  .strict();

export type ResumeGenerateInput = z.input<typeof resumeGenerateRequestSchema>;
export type ResumeGenerateRequest = z.infer<typeof resumeGenerateRequestSchema>;

export const resumeSuggestRequestSchema = z
  .object({
    sectionKind: z.enum(["summary", "experience", "skills", "projects"]),
    entryId: z.string().max(100).optional(),
    bulletId: z.string().max(100).optional(),
    action: z.enum(["improve_impact", "tailor_to_jd", "quantify", "shorten", "rewrite"]),
    jdHistoryId: z.string().uuid().optional(),
    customPrompt: z.string().trim().max(500).optional(),
  })
  .strict();

export type ResumeSuggestRequest = z.infer<typeof resumeSuggestRequestSchema>;

export const resumeSuggestionDtoSchema = z
  .object({
    taskRunId: z.string().uuid(),
    suggestionId: z.string().uuid(),
    sectionKind: z.enum(["summary", "experience", "skills", "projects"]),
    entryId: z.string().nullable().default(null),
    bulletId: z.string().nullable().default(null),
    originalContent: z.string(),
    suggestedContent: z.string(),
    reasoning: z.string(),
    groundedKeywords: z.array(z.string()),
    status: z.literal("pending_review"),
    createdAt: z.string(),
  })
  .strict();

export type ResumeSuggestionDto = z.infer<typeof resumeSuggestionDtoSchema>;

export const resumeApplySuggestionSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    sectionKind: z.enum(["summary", "experience", "skills", "projects"]),
    entryId: z.string().max(100).optional(),
    bulletId: z.string().max(100).optional(),
    appliedContent: z.string().trim().min(1).max(5000),
    suggestionId: z.string().uuid().optional(),
  })
  .strict();

export type ResumeApplySuggestion = z.infer<typeof resumeApplySuggestionSchema>;

export const taskRunDtoSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.string(),
    dispatchStatus: z.string(),
    taskType: z.string(),
    status: z.string(),
    result: z.record(z.unknown()).nullable(),
    errorMessage: z.string().nullable(),
    resumeId: z.string().uuid().nullable(),
    createdAt: z.string(),
    completedAt: z.string().nullable(),
  })
  .strict();

export type TaskRunDto = z.infer<typeof taskRunDtoSchema>;

