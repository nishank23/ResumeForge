import { z } from "zod";

export const parsedKeywordSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    category: z.enum(["technical", "soft_skills", "domain", "tools", "education", "general"]),
    required: z.boolean().default(false),
    evidence: z.string().trim().max(500).default(""),
  })
  .strict();

export type ParsedKeywordDto = z.infer<typeof parsedKeywordSchema>;

export const jdParseRequestSchema = z
  .object({
    rawJD: z
      .string()
      .trim()
      .min(50, "Job description must be at least 50 characters")
      .max(50_000, "Job description exceeds 50,000 characters"),
    jobTitle: z.string().trim().max(200).optional(),
    company: z.string().trim().max(200).optional(),
  })
  .strict();

export type JdParseRequest = z.infer<typeof jdParseRequestSchema>;

export const parsedJdContentSchema = z
  .object({
    jobTitle: z.string().trim().max(200),
    company: z.string().trim().max(200),
    experienceLevel: z
      .enum(["entry", "mid", "senior", "lead", "executive", "unknown"])
      .nullable()
      .default(null),
    roleType: z
      .enum(["full-time", "part-time", "contract", "internship", "remote", "hybrid", "unknown"])
      .nullable()
      .default(null),
    keywords: z.array(parsedKeywordSchema).default([]),
    requirements: z.array(z.string().trim().max(1000)).default([]),
    responsibilities: z.array(z.string().trim().max(1000)).default([]),
  })
  .strict();

export type ParsedJdContentDto = z.infer<typeof parsedJdContentSchema>;

export const jdHistoryDtoSchema = z
  .object({
    id: z.string().uuid(),
    profileId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    jobTitle: z.string(),
    company: z.string(),
    rawJD: z.string(),
    parsedKeywords: z.array(parsedKeywordSchema),
    parsedRequirements: z.array(z.string()),
    parsedResponsibilities: z.array(z.string()),
    experienceLevel: z.string().nullable(),
    roleType: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();

export type JdHistoryDto = z.infer<typeof jdHistoryDtoSchema>;

export const atsBreakdownSchema = z
  .object({
    overallScore: z.number().min(0).max(100),
    rubricVersion: z.string().default("1.0.0"),
    keywordMatch: z.object({
      matched: z.array(z.string()),
      missing: z.array(z.string()),
      score: z.number().min(0).max(100),
    }),
    experienceRelevance: z.object({
      score: z.number().min(0).max(100),
      feedback: z.string(),
    }),
    skillsCoverage: z.object({
      matched: z.array(z.string()),
      missing: z.array(z.string()),
      score: z.number().min(0).max(100),
    }),
    completenessScore: z.number().min(0).max(100),
    readabilityScore: z.number().min(0).max(100),
    recommendations: z.array(z.string()),
  })
  .strict();

export type AtsBreakdownDto = z.infer<typeof atsBreakdownSchema>;

export const resumeTailorRequestSchema = z
  .object({
    jdHistoryId: z.string().uuid().optional(),
    rawJD: z.string().trim().min(50).max(50_000).optional(),
  })
  .strict()
  .refine(
    (data) => data.jdHistoryId !== undefined || data.rawJD !== undefined,
    "Either jdHistoryId or rawJD must be provided",
  );

export type ResumeTailorRequest = z.infer<typeof resumeTailorRequestSchema>;

export const resumeTailorResponseSchema = z
  .object({
    resumeId: z.string().uuid(),
    jdHistoryId: z.string().uuid().nullable(),
    atsScore: z.number().min(0).max(100),
    atsBreakdown: atsBreakdownSchema,
  })
  .strict();

export type ResumeTailorResponseDto = z.infer<typeof resumeTailorResponseSchema>;
