import { z } from "zod";
import { editorDocumentSchema } from "@resume-forge/shared-types";

export type ResumeErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "file_too_large"
  | "unsupported_media_type"
  | "revision_conflict"
  | "resume_unavailable";

export class ResumeError extends Error {
  readonly code: ResumeErrorCode;
  constructor(code: ResumeErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ResumeError";
    this.code = code;
  }
}

export const resumeBulletSchema = z
  .object({
    id: z.string().min(1).max(100),
    text: z.string().max(2000),
    hidden: z.boolean().default(false),
  })
  .strict();

export type ResumeBulletDto = z.infer<typeof resumeBulletSchema>;

export const resumeLinkSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().max(100),
    url: z.string().max(1000),
  })
  .strict();

export const resumeHeaderSchema = z
  .object({
    firstName: z.string().max(100).default(""),
    lastName: z.string().max(100).default(""),
    fullName: z.string().max(200).default(""),
    headline: z.string().max(200).default(""),
    city: z.string().max(100).default(""),
    state: z.string().max(100).default(""),
    country: z.string().max(100).default(""),
    email: z.string().max(200).default(""),
    phone: z.string().max(50).default(""),
    links: z.array(resumeLinkSchema).default([]),
  })
  .strict();

export type ResumeHeaderDto = z.infer<typeof resumeHeaderSchema>;

export const resumeExperienceEntrySchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().max(200),
    subtitle: z.string().max(200), // company name
    location: z.string().max(200).default(""),
    startDate: z.string().max(50).default(""),
    endDate: z.string().max(50).default(""),
    isCurrent: z.boolean().default(false),
    bullets: z.array(resumeBulletSchema).default([]),
    hidden: z.boolean().default(false),
  })
  .strict();

export type ResumeExperienceEntryDto = z.infer<
  typeof resumeExperienceEntrySchema
>;

export const resumeEducationEntrySchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().max(200), // institution
    subtitle: z.string().max(200), // degree
    fieldOfStudy: z.string().max(200).default(""),
    startDate: z.string().max(50).default(""),
    endDate: z.string().max(50).default(""),
    grade: z.string().max(50).default(""),
    hidden: z.boolean().default(false),
  })
  .strict();

export type ResumeEducationEntryDto = z.infer<
  typeof resumeEducationEntrySchema
>;

export const resumeSkillGroupSchema = z
  .object({
    id: z.string().min(1).max(100),
    label: z.string().max(100),
    items: z.array(resumeBulletSchema).default([]),
  })
  .strict();

export type ResumeSkillGroupDto = z.infer<typeof resumeSkillGroupSchema>;

export const resumeProjectEntrySchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().max(200),
    subtitle: z.string().max(200).default(""),
    description: z.string().max(2000).default(""),
    technologies: z.string().max(500).default(""),
    bullets: z.array(resumeBulletSchema).default([]),
    links: z.array(resumeLinkSchema).default([]),
    hidden: z.boolean().default(false),
  })
  .strict();

export type ResumeProjectEntryDto = z.infer<typeof resumeProjectEntrySchema>;

export const resumeSectionSchema = z
  .object({
    id: z.string().min(1).max(100),
    kind: z.enum([
      "summary",
      "experience",
      "education",
      "skills",
      "projects",
      "certifications",
      "languages",
    ]),
    label: z.string().max(100),
    hidden: z.boolean().default(false),
    summary: z.string().max(5000).default(""),
    entries: z.array(z.record(z.unknown())).default([]),
    groups: z.array(resumeSkillGroupSchema).default([]),
  })
  .strict();

export type ResumeSectionDto = z.infer<typeof resumeSectionSchema>;

export const parsedResumeContentSchema = z
  .object({
    title: z.string().max(200).default("Untitled Resume"),
    header: resumeHeaderSchema,
    sampleContact: z
      .object({
        email: z.string().max(200).default(""),
        phone: z.string().max(50).default(""),
      })
      .strict(),
    sections: z.array(resumeSectionSchema).default([]),
    rawText: z.string().max(500000).optional(),
    editorDraft: editorDocumentSchema.optional(),
  })
  .strict();

export type ParsedResumeContentDto = z.infer<typeof parsedResumeContentSchema>;

export const resumeImportRequestSchema = z
  .object({
    fileName: z.string().max(255),
    mimeType: z
      .enum([
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
        "text/markdown",
        "application/json",
      ])
      .default("text/plain"),
    fileBase64: z.string().max(15_000_000).optional(), // ~10MB file limit in base64
    rawText: z.string().max(500_000).optional(),
    title: z.string().max(200).optional(),
    templateId: z.string().max(50).default("default"),
  })
  .strict()
  .refine(
    (data) => Boolean(data.fileBase64 || data.rawText),
    "Either fileBase64 or rawText must be provided",
  );

export type ResumeImportRequest = z.infer<typeof resumeImportRequestSchema>;

export const resumeParseRequestSchema = z
  .object({
    fileName: z.string().max(255),
    mimeType: z
      .enum([
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
        "text/markdown",
        "application/json",
      ])
      .default("text/plain"),
    fileBase64: z.string().max(15_000_000).optional(),
    rawText: z.string().max(500_000).optional(),
  })
  .strict()
  .refine(
    (data) => Boolean(data.fileBase64 || data.rawText),
    "Either fileBase64 or rawText must be provided",
  );

export type ResumeParseRequest = z.infer<typeof resumeParseRequestSchema>;

export interface ResumeSummaryDto {
  readonly id: string;
  readonly profileId: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly templateId: string | null;
  readonly currentVersion: number;
  readonly status: string;
  readonly atsScore: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResumeDetailDto extends ResumeSummaryDto {
  readonly content: ParsedResumeContentDto;
}

export const resumeUpdateRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive().max(2_147_483_646),
    title: z.string().trim().min(1).max(200).optional(),
    templateId: z.string().trim().max(50).nullable().optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    content: parsedResumeContentSchema,
  })
  .strict();

export type ResumeUpdateRequest = z.infer<typeof resumeUpdateRequestSchema>;

export interface ResumeVersionDto {
  readonly id: string;
  readonly resumeId: string;
  readonly versionNumber: number;
  readonly content: ParsedResumeContentDto;
  readonly createdAt: string;
  readonly createdByUserId: string;
}

export type ResumeDownloadFormat = "json" | "markdown" | "text" | "html";

export const resumeCreateRequestSchema = z
  .object({ id: z.string().uuid(), content: parsedResumeContentSchema })
  .strict()
  .refine(
    (v) =>
      v.content.editorDraft?.synthetic === false &&
      v.content.title === v.content.editorDraft.title,
    "A real editor document is required",
  );
