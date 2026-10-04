import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizePersonalScope } from "@resume-forge/access-policy";
import {
  resolvedActorSchema,
  type ResolvedActor,
} from "@resume-forge/access-policy/server";
import {
  type AuditEventIntent,
} from "@resume-forge/audit-contracts";
import {
  withPersonalAuditTransaction,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import {
  ResumeError,
  resumeImportRequestSchema,
  resumeParseRequestSchema,
  resumeUpdateRequestSchema,
  type ResumeImportRequest,
  type ResumeParseRequest,
  type ResumeUpdateRequest,
  type ResumeVersionDto,
  type ResumeDownloadFormat,
  type ParsedResumeContentDto,
  type ResumeDetailDto,
  type ResumeSummaryDto,
} from "./contracts.js";
import { extractTextFromFile } from "./extractor.js";
import { parseResumeText } from "./parser.js";
import {
  formatResumeAsMarkdown,
  formatResumeAsText,
  formatResumeAsHtml,
} from "./formatter.js";
import {
  type JdParseRequest,
  type ParsedJdContentDto,
  type ParsedKeywordDto,
  type JdHistoryDto,
  type ResumeTailorRequest,
  type ResumeTailorResponseDto,
  jdParseRequestSchema,
  resumeTailorRequestSchema,
} from "./jd-contracts.js";
import { parseJdText } from "./jd-parser.js";
import { computeAtsScore } from "./ats-scorer.js";

type Database = ReturnType<typeof createDatabaseClient>;

type JsonObject = { [Key in string]?: JsonValue | null };
type JsonArray = (JsonValue | null)[];
type JsonValue = string | number | boolean | JsonObject | JsonArray;

export interface ResumeServiceContext {
  actor: ResolvedActor;
  selectedWorkspaceId?: string;
  correlationId: string;
}

function toKeywords(val: unknown): ParsedKeywordDto[] {
  return Array.isArray(val) ? (val as ParsedKeywordDto[]) : [];
}

function toStringArray(val: unknown): string[] {
  return Array.isArray(val) ? (val as string[]) : [];
}

export function createResumeUseCases(db: Database, now = Date.now) {
  function assertContext(context: ResumeServiceContext) {
    if (
      !resolvedActorSchema.safeParse(context.actor).success ||
      context.actor.expiresAt <= now()
    ) {
      throw new ResumeError("unauthenticated");
    }
    if (!z.string().uuid().safeParse(context.correlationId).success) {
      throw new ResumeError("invalid_input", "Invalid correlation ID");
    }
  }

  function createAuditIntent(
    context: ResumeServiceContext,
    action: AuditEventIntent["action"],
    resourceId: string,
    metadata: AuditEventIntent["metadata"] = {},
  ): AuditEventIntent {
    return {
      eventId: randomUUID(),
      action,
      actorUserId: context.actor.userId,
      targetUserId: context.actor.userId,
      workspaceType: "individual",
      workspaceId: context.actor.personalWorkspaceId,
      resourceType: "resume",
      resourceId,
      outcome: "succeeded",
      occurredAt: new Date(now()).toISOString(),
      correlationId: context.correlationId,
      metadata,
    };
  }

  async function authorizeWorkspace(
    context: ResumeServiceContext,
    _permission: "resume.create" | "resume.read" | "resume.update" | "resume.delete",
  ) {
    assertContext(context);
    const workspace = await db.workspace.findFirst({
      where: {
        id: context.actor.personalWorkspaceId,
        type: "individual",
        personalOwnerUserId: context.actor.userId,
      },
      select: { id: true, type: true, personalOwnerUserId: true },
    });

    if (!workspace || !workspace.personalOwnerUserId) {
      throw new ResumeError("forbidden", "Workspace not found or unauthorized");
    }

    const decision = authorizePersonalScope({
      actorUserId: context.actor.userId,
      workspace: {
        id: workspace.id,
        type: workspace.type,
        personalOwnerUserId: workspace.personalOwnerUserId,
      },
      clientSelectedWorkspaceId: context.selectedWorkspaceId,
    });

    if (!decision.allowed) {
      throw new ResumeError("forbidden", decision.code);
    }

    return workspace;
  }

  /**
   * Imports a resume file, extracts text, parses structured sections,
   * and persists Resume + ResumeVersion records in the database.
   */
  async function importResume(
    context: ResumeServiceContext,
    input: ResumeImportRequest,
  ): Promise<ResumeDetailDto> {
    const parsedInput = resumeImportRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    const data = parsedInput.data;

    const workspace = await authorizeWorkspace(context, "resume.create");

    // Extract text from base64 buffer or rawText
    let rawText: string;
    if (data.fileBase64) {
      const buffer = Buffer.from(data.fileBase64, "base64");
      const result = extractTextFromFile(buffer, data.mimeType, data.fileName);
      rawText = result.text;
    } else if (data.rawText) {
      rawText = data.rawText;
    } else {
      throw new ResumeError("invalid_input", "No file or text provided");
    }

    if (!rawText.trim()) {
      throw new ResumeError(
        "invalid_input",
        "Could not extract readable text from file",
      );
    }

    // Heuristically parse extracted text into structured resume content
    const parsedContent = parseResumeText(rawText, data.fileName);
    if (data.title) {
      parsedContent.title = data.title;
    }

    // Ensure user has a profile record for foreign key integrity
    let profile = await db.userProfile.findUnique({
      where: { userId: context.actor.userId },
      select: { id: true },
    });

    if (!profile) {
      // Create minimal master profile if missing
      profile = await db.userProfile.create({
        data: {
          userId: context.actor.userId,
          fullName: parsedContent.header.fullName || "User",
          location: parsedContent.header.city
            ? `${parsedContent.header.city}${parsedContent.header.state ? `, ${parsedContent.header.state}` : ""}`
            : null,
          professionalSummary:
            parsedContent.sections.find((s) => s.kind === "summary")?.summary || null,
        },
        select: { id: true },
      });
    }

    const resumeId = randomUUID();
    const versionId = randomUUID();

    const auditIntent = createAuditIntent(context, "resume.created", resumeId, {
      versionId,
      status: "draft",
    });

    // Transactionally persist Resume + ResumeVersion + AuditOutbox
    const created = await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        const resumeRecord = await tx.resume.create({
          data: {
            id: resumeId,
            profileId: profile.id,
            ownerUserId: context.actor.userId,
            workspaceType: "individual",
            workspaceId: workspace.id,
            createdByUserId: context.actor.userId,
            templateId: data.templateId,
            content: JSON.parse(JSON.stringify(parsedContent)) as JsonObject,
            status: "draft",
            currentVersion: 1,
          },
        });

        await tx.resumeVersion.create({
          data: {
            id: versionId,
            resumeId,
            versionNumber: 1,
            content: JSON.parse(JSON.stringify(parsedContent)) as JsonObject,
            createdByUserId: context.actor.userId,
          },
        });

        return resumeRecord;
      },
    );

    return {
      id: created.id,
      profileId: created.profileId,
      workspaceId: created.workspaceId,
      title: parsedContent.title,
      templateId: created.templateId,
      currentVersion: created.currentVersion,
      status: created.status,
      atsScore: created.atsScore,
      content: parsedContent,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Parses resume text/file without persisting to the database.
   */
  async function parseResumeOnly(
    input: ResumeParseRequest,
  ): Promise<ParsedResumeContentDto> {
    await Promise.resolve();
    const parsedInput = resumeParseRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    const data = parsedInput.data;

    let rawText: string;
    if (data.fileBase64) {
      const buffer = Buffer.from(data.fileBase64, "base64");
      const result = extractTextFromFile(buffer, data.mimeType, data.fileName);
      rawText = result.text;
    } else if (data.rawText) {
      rawText = data.rawText;
    } else {
      throw new ResumeError("invalid_input", "No file or text provided");
    }

    if (!rawText.trim()) {
      throw new ResumeError("invalid_input", "No readable text extracted");
    }

    return parseResumeText(rawText, data.fileName);
  }

  /**
   * Fetches an owned resume and its current version content.
   */
  async function getResumeById(
    context: ResumeServiceContext,
    resumeId: string,
  ): Promise<ResumeDetailDto> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }

    await authorizeWorkspace(context, "resume.read");

    const resume = await db.resume.findFirst({
      where: {
        id: resumeId,
        ownerUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
      include: {
        versions: {
          where: { versionNumber: 1 },
          take: 1,
        },
      },
    });

    if (!resume) {
      throw new ResumeError("not_found", "Resume not found");
    }

    const rawContent = resume.content ?? resume.versions[0]?.content;
    const content = (rawContent ?? {}) as unknown as ParsedResumeContentDto;

    return {
      id: resume.id,
      profileId: resume.profileId,
      workspaceId: resume.workspaceId,
      title: content.title || "Untitled Resume",
      templateId: resume.templateId,
      currentVersion: resume.currentVersion,
      status: resume.status,
      atsScore: resume.atsScore,
      content,
      createdAt: resume.createdAt.toISOString(),
      updatedAt: resume.updatedAt.toISOString(),
    };
  }

  /**
   * Lists all resumes owned by the authenticated actor in the workspace.
   */
  async function listResumes(
    context: ResumeServiceContext,
  ): Promise<ResumeSummaryDto[]> {
    await authorizeWorkspace(context, "resume.read");

    const resumes = await db.resume.findMany({
      where: {
        ownerUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
      orderBy: { updatedAt: "desc" },
    });

    return resumes.map((r) => {
      const content = r.content as unknown as ParsedResumeContentDto | null;
      return {
        id: r.id,
        profileId: r.profileId,
        workspaceId: r.workspaceId,
        title: content?.title || "Untitled Resume",
        templateId: r.templateId,
        currentVersion: r.currentVersion,
        status: r.status,
        atsScore: r.atsScore,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Updates an existing resume, creates a new version, and advances currentVersion.
   * Ensures strict ID isolation (editing resume 1 ONLY updates resume 1).
   */
  async function updateResume(
    context: ResumeServiceContext,
    resumeId: string,
    input: ResumeUpdateRequest,
  ): Promise<ResumeDetailDto> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    const parsedInput = resumeUpdateRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    const data = parsedInput.data;
    await authorizeWorkspace(context, "resume.update");

    const versionId = randomUUID();
    const auditIntent = createAuditIntent(context, "resume.updated", resumeId, {
      versionId,
      status: data.status ?? "draft",
    });

    const updated = await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        const existing = await tx.resume.findFirst({
          where: {
            id: resumeId,
            ownerUserId: context.actor.userId,
            workspaceId: context.actor.personalWorkspaceId,
          },
          select: { id: true, currentVersion: true },
        });

        if (!existing) {
          throw new ResumeError("not_found", "Resume not found");
        }

        if (existing.currentVersion !== data.expectedVersion) {
          throw new ResumeError("revision_conflict", "Resume version conflict");
        }

        const newVersionNumber = existing.currentVersion + 1;

        await tx.resumeVersion.create({
          data: {
            id: versionId,
            resumeId,
            versionNumber: newVersionNumber,
            content: JSON.parse(JSON.stringify(data.content)) as JsonObject,
            createdByUserId: context.actor.userId,
          },
        });

        const contentToSave = {
          ...data.content,
          ...(data.title ? { title: data.title } : {}),
        };

        const resumeRecord = await tx.resume.update({
          where: { id: resumeId },
          data: {
            currentVersion: newVersionNumber,
            content: JSON.parse(JSON.stringify(contentToSave)) as JsonObject,
            ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
            ...(data.status ? { status: data.status } : {}),
          },
        });

        return resumeRecord;
      },
    );

    return {
      id: updated.id,
      profileId: updated.profileId,
      workspaceId: updated.workspaceId,
      title: data.title ?? data.content.title,
      templateId: updated.templateId,
      currentVersion: updated.currentVersion,
      status: updated.status,
      atsScore: updated.atsScore,
      content: data.content,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Deletes a resume and all its version history.
   */
  async function deleteResume(
    context: ResumeServiceContext,
    resumeId: string,
  ): Promise<{ deleted: true; id: string }> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    await authorizeWorkspace(context, "resume.delete");

    const auditIntent = createAuditIntent(context, "resume.deleted", resumeId, {});

    await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        const existing = await tx.resume.findFirst({
          where: {
            id: resumeId,
            ownerUserId: context.actor.userId,
            workspaceId: context.actor.personalWorkspaceId,
          },
          select: { id: true },
        });

        if (!existing) {
          throw new ResumeError("not_found", "Resume not found");
        }

        await tx.resumeVersion.deleteMany({ where: { resumeId } });
        await tx.taskRun.deleteMany({ where: { resumeId } });
        await tx.resume.delete({ where: { id: resumeId } });
        return null;
      },
    );

    return { deleted: true, id: resumeId };
  }

  /**
   * Downloads a resume in JSON, Markdown, Text, or HTML format with audit logging.
   */
  async function downloadResume(
    context: ResumeServiceContext,
    resumeId: string,
    format: ResumeDownloadFormat,
  ): Promise<{ content: string; mimeType: string; fileName: string }> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    await authorizeWorkspace(context, "resume.read");

    const auditIntent = createAuditIntent(context, "resume.downloaded", resumeId, {
      status: "succeeded",
    });

    const result = await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        const resume = await tx.resume.findFirst({
          where: {
            id: resumeId,
            ownerUserId: context.actor.userId,
            workspaceId: context.actor.personalWorkspaceId,
          },
          select: { id: true, content: true, status: true },
        });

        if (!resume) {
          throw new ResumeError("not_found", "Resume not found");
        }

        const rawContent = (resume.content ?? {}) as unknown as ParsedResumeContentDto;
        const title = (rawContent.title || "Resume").replace(/[^a-zA-Z0-9_-]/g, "_");

        let output: string;
        let mimeType: string;
        let ext: string;

        if (format === "json") {
          output = JSON.stringify(rawContent, null, 2);
          mimeType = "application/json; charset=utf-8";
          ext = "json";
        } else if (format === "markdown") {
          output = formatResumeAsMarkdown(rawContent);
          mimeType = "text/markdown; charset=utf-8";
          ext = "md";
        } else if (format === "html") {
          output = formatResumeAsHtml(rawContent);
          mimeType = "text/html; charset=utf-8";
          ext = "html";
        } else {
          output = formatResumeAsText(rawContent);
          mimeType = "text/plain; charset=utf-8";
          ext = "txt";
        }

        return {
          content: output,
          mimeType,
          fileName: `${title}.${ext}`,
        };
      },
    );

    return result;
  }

  /**
   * Lists historical versions of a resume.
   */
  async function listResumeVersions(
    context: ResumeServiceContext,
    resumeId: string,
  ): Promise<ResumeVersionDto[]> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    await authorizeWorkspace(context, "resume.read");

    const resume = await db.resume.findFirst({
      where: {
        id: resumeId,
        ownerUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
      select: { id: true },
    });

    if (!resume) {
      throw new ResumeError("not_found", "Resume not found");
    }

    const versions = await db.resumeVersion.findMany({
      where: { resumeId },
      orderBy: { versionNumber: "desc" },
    });

    return versions.map((v) => ({
      id: v.id,
      resumeId: v.resumeId,
      versionNumber: v.versionNumber,
      content: v.content as unknown as ParsedResumeContentDto,
      createdAt: v.createdAt.toISOString(),
      createdByUserId: v.createdByUserId,
    }));
  }

  /**
   * Clones a resume to create a new independent copy.
   */
  async function cloneResume(
    context: ResumeServiceContext,
    resumeId: string,
    newTitle?: string,
  ): Promise<ResumeDetailDto> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    const workspace = await authorizeWorkspace(context, "resume.create");

    const source = await db.resume.findFirst({
      where: {
        id: resumeId,
        ownerUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
    });

    if (!source) {
      throw new ResumeError("not_found", "Resume not found");
    }

    const content = JSON.parse(JSON.stringify(source.content ?? {})) as ParsedResumeContentDto;
    const title = newTitle || `${content.title || "Resume"} (Copy)`;
    content.title = title;

    const clonedId = randomUUID();
    const versionId = randomUUID();

    const auditIntent = createAuditIntent(context, "resume.created", clonedId, {
      versionId,
      status: "draft",
    });

    const created = await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        const resumeRecord = await tx.resume.create({
          data: {
            id: clonedId,
            profileId: source.profileId,
            ownerUserId: context.actor.userId,
            workspaceType: "individual",
            workspaceId: workspace.id,
            createdByUserId: context.actor.userId,
            templateId: source.templateId,
            content: JSON.parse(JSON.stringify(content)) as JsonObject,
            status: "draft",
            currentVersion: 1,
          },
        });

        await tx.resumeVersion.create({
          data: {
            id: versionId,
            resumeId: clonedId,
            versionNumber: 1,
            content: JSON.parse(JSON.stringify(content)) as JsonObject,
            createdByUserId: context.actor.userId,
          },
        });

        return resumeRecord;
      },
    );

    return {
      id: created.id,
      profileId: created.profileId,
      workspaceId: created.workspaceId,
      title,
      templateId: created.templateId,
      currentVersion: created.currentVersion,
      status: created.status,
      atsScore: created.atsScore,
      content,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Parses JD text without persisting to the database.
   */
  async function parseJdOnly(
    input: JdParseRequest,
  ): Promise<ParsedJdContentDto> {
    await Promise.resolve();
    const parsedInput = jdParseRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    return parseJdText(parsedInput.data.rawJD, parsedInput.data.jobTitle, parsedInput.data.company);
  }

  /**
   * Parses a job description and persists it into JDHistory.
   */
  async function parseAndSaveJD(
    context: ResumeServiceContext,
    input: JdParseRequest,
  ): Promise<JdHistoryDto> {
    const parsedInput = jdParseRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    const data = parsedInput.data;
    const workspace = await authorizeWorkspace(context, "resume.create");

    // Ensure user profile exists
    let profile = await db.userProfile.findUnique({
      where: { userId: context.actor.userId },
      select: { id: true },
    });

    if (!profile) {
      profile = await db.userProfile.create({
        data: {
          userId: context.actor.userId,
          fullName: "User",
        },
        select: { id: true },
      });
    }

    const parsedContent = parseJdText(data.rawJD, data.jobTitle, data.company);
    const jdId = randomUUID();

    const auditIntent = createAuditIntent(context, "resume.created", jdId, {
      status: "succeeded",
      reasonCode: "jd_created",
    });

    const created = await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        const jdRecord = await tx.jDHistory.create({
          data: {
            id: jdId,
            profileId: profile.id,
            workspaceType: "individual",
            workspaceId: workspace.id,
            createdByUserId: context.actor.userId,
            jobTitle: parsedContent.jobTitle,
            company: parsedContent.company,
            rawJD: data.rawJD,
            parsedKeywords: JSON.parse(JSON.stringify(parsedContent.keywords)) as JsonValue,
            parsedRequirements: JSON.parse(JSON.stringify(parsedContent.requirements)) as JsonValue,
            parsedResponsibilities: JSON.parse(JSON.stringify(parsedContent.responsibilities)) as JsonValue,
            experienceLevel: parsedContent.experienceLevel,
            roleType: parsedContent.roleType,
          },
        });
        return jdRecord;
      },
    );

    return {
      id: created.id,
      profileId: created.profileId,
      workspaceId: created.workspaceId,
      jobTitle: created.jobTitle,
      company: created.company,
      rawJD: created.rawJD,
      parsedKeywords: toKeywords(created.parsedKeywords),
      parsedRequirements: toStringArray(created.parsedRequirements),
      parsedResponsibilities: toStringArray(created.parsedResponsibilities),
      experienceLevel: created.experienceLevel,
      roleType: created.roleType,
      createdAt: created.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves a specific JDHistory record by ID with strict ownership validation.
   */
  async function getJDHistoryById(
    context: ResumeServiceContext,
    jdId: string,
  ): Promise<JdHistoryDto> {
    if (!z.string().uuid().safeParse(jdId).success) {
      throw new ResumeError("invalid_input", "Invalid JD ID");
    }
    await authorizeWorkspace(context, "resume.read");

    const record = await db.jDHistory.findFirst({
      where: {
        id: jdId,
        createdByUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
    });

    if (!record) {
      throw new ResumeError("not_found", "Job description not found");
    }

    return {
      id: record.id,
      profileId: record.profileId,
      workspaceId: record.workspaceId,
      jobTitle: record.jobTitle,
      company: record.company,
      rawJD: record.rawJD,
      parsedKeywords: toKeywords(record.parsedKeywords),
      parsedRequirements: toStringArray(record.parsedRequirements),
      parsedResponsibilities: toStringArray(record.parsedResponsibilities),
      experienceLevel: record.experienceLevel,
      roleType: record.roleType,
      createdAt: record.createdAt.toISOString(),
    };
  }

  /**
   * Lists all JDHistory records owned by the authenticated actor.
   */
  async function listJDHistories(
    context: ResumeServiceContext,
  ): Promise<JdHistoryDto[]> {
    await authorizeWorkspace(context, "resume.read");

    const records = await db.jDHistory.findMany({
      where: {
        createdByUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record) => ({
      id: record.id,
      profileId: record.profileId,
      workspaceId: record.workspaceId,
      jobTitle: record.jobTitle,
      company: record.company,
      rawJD: record.rawJD,
      parsedKeywords: toKeywords(record.parsedKeywords),
      parsedRequirements: toStringArray(record.parsedRequirements),
      parsedResponsibilities: toStringArray(record.parsedResponsibilities),
      experienceLevel: record.experienceLevel,
      roleType: record.roleType,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  /**
   * Tailors a resume against a JD: computes ATS score breakdown and updates the resume record.
   */
  async function tailorResume(
    context: ResumeServiceContext,
    resumeId: string,
    input: ResumeTailorRequest,
  ): Promise<ResumeTailorResponseDto> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    const parsedInput = resumeTailorRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    const data = parsedInput.data;
    await authorizeWorkspace(context, "resume.update");

    // Fetch existing resume
    const resume = await db.resume.findFirst({
      where: {
        id: resumeId,
        ownerUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!resume) {
      throw new ResumeError("not_found", "Resume not found");
    }

    let parsedJd: ParsedJdContentDto;
    let jdHistoryId: string | null = null;

    if (data.jdHistoryId) {
      const jdRecord = await db.jDHistory.findFirst({
        where: {
          id: data.jdHistoryId,
          createdByUserId: context.actor.userId,
          workspaceId: context.actor.personalWorkspaceId,
        },
      });
      if (!jdRecord) {
        throw new ResumeError("not_found", "Job description history not found");
      }
      parsedJd = {
        jobTitle: jdRecord.jobTitle,
        company: jdRecord.company,
        experienceLevel: (jdRecord.experienceLevel as ParsedJdContentDto["experienceLevel"]) ?? "unknown",
        roleType: (jdRecord.roleType as ParsedJdContentDto["roleType"]) ?? "unknown",
        keywords: toKeywords(jdRecord.parsedKeywords),
        requirements: toStringArray(jdRecord.parsedRequirements),
        responsibilities: toStringArray(jdRecord.parsedResponsibilities),
      };
      jdHistoryId = jdRecord.id;
    } else if (data.rawJD) {
      parsedJd = parseJdText(data.rawJD);
      // Persist as JDHistory for provenance and linkage
      const newJdId = randomUUID();
      let profile = await db.userProfile.findUnique({
        where: { userId: context.actor.userId },
        select: { id: true },
      });
      if (!profile) {
        profile = await db.userProfile.create({
          data: { userId: context.actor.userId, fullName: "User" },
          select: { id: true },
        });
      }
      const newJd = await db.jDHistory.create({
        data: {
          id: newJdId,
          profileId: profile.id,
          workspaceType: "individual",
          workspaceId: resume.workspaceId,
          createdByUserId: context.actor.userId,
          jobTitle: parsedJd.jobTitle,
          company: parsedJd.company,
          rawJD: data.rawJD,
          parsedKeywords: JSON.parse(JSON.stringify(parsedJd.keywords)) as JsonValue,
          parsedRequirements: JSON.parse(JSON.stringify(parsedJd.requirements)) as JsonValue,
          parsedResponsibilities: JSON.parse(JSON.stringify(parsedJd.responsibilities)) as JsonValue,
          experienceLevel: parsedJd.experienceLevel,
          roleType: parsedJd.roleType,
        },
      });
      jdHistoryId = newJd.id;
    } else {
      throw new ResumeError("invalid_input", "Either jdHistoryId or rawJD must be provided");
    }

    const rawContent = resume.content ?? resume.versions[0]?.content;
    const resumeContent = (rawContent ?? {}) as unknown as ParsedResumeContentDto;

    const atsBreakdown = computeAtsScore(resumeContent, parsedJd);

    const auditIntent = createAuditIntent(context, "resume.updated", resumeId, {
      status: "succeeded",
      reasonCode: "tailor_resume",
    });

    await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        await tx.resume.update({
          where: { id: resumeId },
          data: {
            atsScore: atsBreakdown.overallScore,
            atsBreakdown: JSON.parse(JSON.stringify(atsBreakdown)) as JsonObject,
            jdHistoryId,
          },
        });

        if (resume.versions[0]) {
          await tx.resumeVersion.update({
            where: { id: resume.versions[0].id },
            data: {
              atsScore: atsBreakdown.overallScore,
              atsBreakdown: JSON.parse(JSON.stringify(atsBreakdown)) as JsonObject,
            },
          });
        }
      },
    );

    return {
      resumeId,
      jdHistoryId,
      atsScore: atsBreakdown.overallScore,
      atsBreakdown,
    };
  }

  return {
    importResume,
    parseResumeOnly,
    getResumeById,
    listResumes,
    updateResume,
    deleteResume,
    downloadResume,
    listResumeVersions,
    cloneResume,
    parseJdOnly,
    parseAndSaveJD,
    getJDHistoryById,
    listJDHistories,
    tailorResume,
  };
}
