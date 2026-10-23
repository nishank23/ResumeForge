import { z } from "zod";

/** Versioned job-evidence coverage. This is not an employer's ATS algorithm. */
export const ATS_RUBRIC = "ats-evidence-v1" as const;
export const atsSourceSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    kind: z.enum([
      "summary",
      "experience",
      "projects",
      "education",
      "skills",
      "certifications",
      "languages",
      "other",
    ]),
    text: z.string().trim().min(1).max(6000),
  })
  .strict();
export const atsAssessmentInputSchema = z
  .object({
    jdText: z.string().trim().min(50).max(12000),
    sources: z.array(atsSourceSchema).max(60),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.sources.map((source) => source.id)).size !==
      value.sources.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use unique source IDs.",
      });
    if (
      value.sources.reduce((total, source) => total + source.text.length, 0) >
      60000
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Professional text exceeds the bounded limit.",
      });
  });
export const atsRequirementSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    requirement: z.string().trim().min(1).max(1000),
    jdQuote: z.string().trim().min(1).max(1200),
    importance: z.enum(["required", "preferred"]),
    status: z.enum(["supported", "missing", "uncertain"]),
    evidence: z
      .array(
        z
          .object({
            sourceId: z.string().trim().min(1).max(120),
            quote: z.string().trim().min(1).max(1200),
          })
          .strict(),
      )
      .max(4),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "supported" && value.evidence.length === 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Supported requirements need source evidence.",
      });
    if (value.status === "missing" && value.evidence.length !== 0)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing requirements cannot claim supporting evidence.",
      });
    if (
      new Set(value.evidence.map((item) => JSON.stringify(item))).size !==
      value.evidence.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use unique evidence records.",
      });
  });
const coverageCountSchema = z
  .object({
    supported: z.number().int().min(0).max(60),
    total: z.number().int().min(0).max(60),
  })
  .strict();
export const atsAssessmentSchema = z
  .object({
    rubricVersion: z.literal(ATS_RUBRIC),
    model: z.string().min(1).max(100),
    score: z.number().int().min(0).max(100).nullable(),
    coverage: z
      .object({ required: coverageCountSchema, preferred: coverageCountSchema })
      .strict(),
    requirements: z.array(atsRequirementSchema).max(60),
    warnings: z.array(z.string().trim().min(1).max(400)).max(10),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const importance of ["required", "preferred"] as const) {
      const rows = value.requirements.filter(
        (row) => row.importance === importance,
      );
      const supported = rows.filter((row) => row.status === "supported").length;
      if (
        value.coverage[importance].total !== rows.length ||
        value.coverage[importance].supported !== supported
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Coverage must match the requirement evidence.",
        });
    }
    const selected = value.coverage.required.total
      ? value.coverage.required
      : value.coverage.preferred;
    const expected = selected.total
      ? Math.round((100 * selected.supported) / selected.total)
      : null;
    if (value.score !== expected)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Score must equal supported requirement coverage.",
      });
    if (
      new Set(value.requirements.map((row) => row.id)).size !==
        value.requirements.length ||
      new Set(
        value.requirements.map((row) =>
          row.requirement.toLowerCase().replace(/\s+/g, " "),
        ),
      ).size !== value.requirements.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use distinct job requirements.",
      });
  });
export type AtsAssessmentInput = z.infer<typeof atsAssessmentInputSchema>;
export type AtsRequirement = z.infer<typeof atsRequirementSchema>;
export type AtsAssessment = z.infer<typeof atsAssessmentSchema>;
