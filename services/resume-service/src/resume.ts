import { editorDocumentSchema } from "@resume-forge/shared-types";
import { renderSavedResumePdf } from "./pdf.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizePersonalScope } from "@resume-forge/access-policy";
import {
  resolvedActorSchema,
  type ResolvedActor,
} from "@resume-forge/access-policy/server";
import { type AuditEventIntent } from "@resume-forge/audit-contracts";
import {
  withPersonalAuditTransaction,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import {
  ResumeError,
  resumeCreateRequestSchema,
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
import {
  type ResumeGenerateInput,
  type ResumeSuggestRequest,
  type ResumeSuggestionDto,
  type ResumeApplySuggestion,
  type TaskRunDto,
  resumeGenerateRequestSchema,
  resumeSuggestRequestSchema,
  resumeApplySuggestionSchema,
} from "./generator-contracts.js";
import { mapProfileToResume } from "./content-mapper.js";
import { generateSectionSuggestion } from "./suggestion-engine.js";
import {
  type GapAnalysisRequest,
  type GapAnalysisResultDto,
  gapAnalysisRequestSchema,
} from "./gap-contracts.js";
import { analyzeKeywordGaps } from "./gap-analyzer.js";

type Database = ReturnType<typeof createDatabaseClient>;

class ResumeCreationReplay extends Error {}

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

export function createResumeUseCases(
  db: Database,
  now = Date.now,
  renderPdf = renderSavedResumePdf,
) {
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
    _permission:
      | "resume.create"
      | "resume.read"
      | "resume.update"
      | "resume.delete"
      | "resume.download"
      | "skillgap.analyze"
      | "ats.run"
      | "ats.view",
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

  async function createResume(
    context: ResumeServiceContext,
    input: unknown,
  ): Promise<ResumeDetailDto> {
    const parsed = resumeCreateRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new ResumeError("invalid_input", "Invalid editor document");
    const workspace = await authorizeWorkspace(context, "resume.create");
    const { id, content } = parsed.data;
    const versionId = randomUUID();
    try {
      await withPersonalAuditTransaction(
        db,
        context.actor.userId,
        createAuditIntent(context, "resume.created", id, {
          versionId,
          status: "draft",
        }),
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${context.actor.userId}))`;
          const existing = await tx.resume.findUnique({ where: { id } });
          if (existing) {
            if (
              existing.ownerUserId !== context.actor.userId ||
              existing.workspaceId !== workspace.id
            )
              throw new ResumeError(
                "revision_conflict",
                "Creation ID already used",
              );
            // A repeated creation request retrieves the original; never re-applies content.
            throw new ResumeCreationReplay();
          }
          // Current schema requires this FK. Keep this anchor empty; uploaded facts
          // never overwrite a master professional profile or UserContact.
          let profile = await tx.userProfile.findUnique({
            where: { userId: context.actor.userId },
            select: { id: true },
          });
          if (!profile) {
            const profileId = randomUUID();
            await tx.$executeRaw`INSERT INTO "UserProfile" ("id", "userId", "fullName", "createdAt", "updatedAt") VALUES (${profileId}::uuid, ${context.actor.userId}::uuid, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
            profile = { id: profileId };
          }
          const json = JSON.parse(JSON.stringify(content)) as JsonObject;
          await tx.resume.create({
            data: {
              id,
              profileId: profile.id,
              ownerUserId: context.actor.userId,
              workspaceType: "individual",
              workspaceId: workspace.id,
              createdByUserId: context.actor.userId,
              templateId: "default",
              content: json,
              status: "draft",
            },
          });
          await tx.resumeVersion.create({
            data: {
              id: versionId,
              resumeId: id,
              versionNumber: 1,
              content: json,
              createdByUserId: context.actor.userId,
            },
          });
        },
      );
    } catch (error) {
      // A replay rolls back before audit capture, then returns the owned original.
      if (!(error instanceof ResumeCreationReplay)) throw error;
    }
    return getResumeById(context, id);
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
            parsedContent.sections.find((s) => s.kind === "summary")?.summary ||
            null,
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
        status: { not: "deleted" },
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
    cursor?: string,
  ): Promise<ResumeSummaryDto[]> {
    await authorizeWorkspace(context, "resume.read");
    if (cursor && !z.string().uuid().safeParse(cursor).success)
      throw new ResumeError("invalid_input");
    const boundary = cursor
      ? await db.resume.findFirst({
          where: {
            status: { not: "deleted" },
            id: cursor,
            ownerUserId: context.actor.userId,
            workspaceId: context.actor.personalWorkspaceId,
          },
          select: { id: true, updatedAt: true },
        })
      : null;
    if (cursor && !boundary) throw new ResumeError("not_found");
    const resumes = await db.resume.findMany({
      where: {
        status: { not: "deleted" },
        ownerUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
      ...(boundary ? { cursor: { id: boundary.id }, skip: 1 } : {}),
      take: 50,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
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
    const contentToSave = {
      ...data.content,
      ...(data.title ? { title: data.title } : {}),
      ...(data.content.editorDraft && data.title
        ? { editorDraft: { ...data.content.editorDraft, title: data.title } }
        : {}),
    };
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
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resumeId}))`;
        const existing = await tx.resume.findFirst({
          where: {
            status: { not: "deleted" },
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
            content: JSON.parse(JSON.stringify(contentToSave)) as JsonObject,
            createdByUserId: context.actor.userId,
          },
        });

        const resumeRecord = await tx.resume.update({
          where: { id: resumeId, currentVersion: data.expectedVersion },
          data: {
            currentVersion: newVersionNumber,
            atsScore: null,
            pdfR2Key: null,
            content: JSON.parse(JSON.stringify(contentToSave)) as JsonObject,
            ...(data.templateId !== undefined
              ? { templateId: data.templateId }
              : {}),
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
      content: contentToSave,
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

    const auditIntent = createAuditIntent(
      context,
      "resume.deleted",
      resumeId,
      {},
    );

    await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resumeId}))`;
        const existing = await tx.resume.findFirst({
          where: {
            status: { not: "deleted" },
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

  /** Reversible personal deletion uses existing UPDATE grants; history is immutable. */
  async function removeResume(
    context: ResumeServiceContext,
    resumeId: string,
    input: unknown,
  ) {
    if (!z.string().uuid().safeParse(resumeId).success)
      throw new ResumeError("invalid_input");
    const parsed = z
      .object({ expectedVersion: z.number().int().positive() })
      .strict()
      .safeParse(input);
    if (!parsed.success) throw new ResumeError("invalid_input");
    await authorizeWorkspace(context, "resume.delete");
    await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      createAuditIntent(context, "resume.deleted", resumeId, {
        status: "deleted",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resumeId}))`;
        const existing = await tx.resume.findFirst({
          where: {
            id: resumeId,
            ownerUserId: context.actor.userId,
            workspaceId: context.actor.personalWorkspaceId,
          },
        });
        if (!existing) throw new ResumeError("not_found");
        if (existing.currentVersion !== parsed.data.expectedVersion)
          throw new ResumeError("revision_conflict");
        await tx.resume.update({
          where: { id: resumeId },
          data: { status: "deleted", pdfR2Key: null },
        });
      },
    );
    return { deleted: true as const, id: resumeId };
  }
  async function restoreResume(
    context: ResumeServiceContext,
    resumeId: string,
    input: unknown,
  ) {
    if (!z.string().uuid().safeParse(resumeId).success)
      throw new ResumeError("invalid_input");
    const parsed = z
      .object({ expectedVersion: z.number().int().positive() })
      .strict()
      .safeParse(input);
    if (!parsed.success) throw new ResumeError("invalid_input");
    await authorizeWorkspace(context, "resume.update");
    await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      createAuditIntent(context, "resume.updated", resumeId, {
        status: "restored",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resumeId}))`;
        const existing = await tx.resume.findFirst({
          where: {
            id: resumeId,
            ownerUserId: context.actor.userId,
            workspaceId: context.actor.personalWorkspaceId,
          },
        });
        if (!existing) throw new ResumeError("not_found");
        if (existing.currentVersion !== parsed.data.expectedVersion)
          throw new ResumeError("revision_conflict");
        if (existing.status === "deleted")
          await tx.resume.update({
            where: { id: resumeId },
            data: { status: "draft" },
          });
      },
    );
    return getResumeById(context, resumeId);
  }
  async function downloadPdf(
    context: ResumeServiceContext,
    resumeId: string,
    version: number,
  ) {
    if (
      !z.string().uuid().safeParse(resumeId).success ||
      !Number.isSafeInteger(version) ||
      version < 1
    )
      throw new ResumeError("invalid_input");
    await authorizeWorkspace(context, "resume.download");
    const where = {
      id: resumeId,
      ownerUserId: context.actor.userId,
      workspaceId: context.actor.personalWorkspaceId,
      status: { not: "deleted" },
    };
    const resume = await db.resume.findFirst({
      where,
      select: { id: true, currentVersion: true },
    });
    if (!resume) throw new ResumeError("not_found");
    if (resume.currentVersion !== version)
      throw new ResumeError("revision_conflict");
    const snapshot = await db.resumeVersion.findUnique({
      where: { resumeId_versionNumber: { resumeId, versionNumber: version } },
    });
    if (!snapshot) throw new ResumeError("not_found");
    const content = snapshot.content as Record<string, unknown>;
    const document = editorDocumentSchema.safeParse(content.editorDraft);
    if (!document.success)
      throw new ResumeError(
        "invalid_input",
        "Reopen and save this resume before downloading.",
      );
    const bytes = await renderPdf(document.data);
    // Rendering happens outside the transaction. Deletion, edits or expiry during
    // rendering must deny retrieval, without publishing a stale private artifact.
    await authorizeWorkspace(context, "resume.download");
    await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      createAuditIntent(context, "resume.downloaded", resumeId, {
        versionId: snapshot.id,
        status: "succeeded",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resumeId}))`;
        const current = await tx.resume.findFirst({
          where,
          select: { currentVersion: true },
        });
        if (!current) throw new ResumeError("not_found");
        if (current.currentVersion !== version)
          throw new ResumeError("revision_conflict");
      },
    );
    const title =
      document.data.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100) ||
      "Resume";
    return { bytes, fileName: `${title}-v${String(version)}.pdf`, version };
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

    const auditIntent = createAuditIntent(
      context,
      "resume.downloaded",
      resumeId,
      {
        status: "succeeded",
      },
    );

    const result = await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        const resume = await tx.resume.findFirst({
          where: {
            status: { not: "deleted" },
            id: resumeId,
            ownerUserId: context.actor.userId,
            workspaceId: context.actor.personalWorkspaceId,
          },
          select: { id: true, content: true, status: true },
        });

        if (!resume) {
          throw new ResumeError("not_found", "Resume not found");
        }

        const rawContent = (resume.content ??
          {}) as unknown as ParsedResumeContentDto;
        const title = (rawContent.title || "Resume").replace(
          /[^a-zA-Z0-9_-]/g,
          "_",
        );

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
        status: { not: "deleted" },
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
        status: { not: "deleted" },
        id: resumeId,
        ownerUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
    });

    if (!source) {
      throw new ResumeError("not_found", "Resume not found");
    }

    const content = JSON.parse(
      JSON.stringify(source.content ?? {}),
    ) as ParsedResumeContentDto;
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
    return parseJdText(
      parsedInput.data.rawJD,
      parsedInput.data.jobTitle,
      parsedInput.data.company,
    );
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
            parsedKeywords: JSON.parse(
              JSON.stringify(parsedContent.keywords),
            ) as JsonValue,
            parsedRequirements: JSON.parse(
              JSON.stringify(parsedContent.requirements),
            ) as JsonValue,
            parsedResponsibilities: JSON.parse(
              JSON.stringify(parsedContent.responsibilities),
            ) as JsonValue,
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
   * Deletes a JDHistory entry owned by the user and nullifies foreign key references in Resume records.
   */
  async function deleteJDHistory(
    context: ResumeServiceContext,
    jdId: string,
  ): Promise<{ deleted: true; id: string }> {
    if (!z.string().uuid().safeParse(jdId).success) {
      throw new ResumeError("invalid_input", "Invalid JD ID");
    }
    await authorizeWorkspace(context, "resume.delete");

    const auditIntent = createAuditIntent(context, "resume.deleted", jdId, {
      status: "succeeded",
      reasonCode: "jd_deleted",
    });

    await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        const existing = await tx.jDHistory.findFirst({
          where: {
            id: jdId,
            createdByUserId: context.actor.userId,
            workspaceId: context.actor.personalWorkspaceId,
          },
          select: { id: true },
        });

        if (!existing) {
          throw new ResumeError("not_found", "Job description not found");
        }

        // Nullify references in Resume where jdHistoryId is this record
        await tx.resume.updateMany({
          where: {
            jdHistoryId: jdId,
            ownerUserId: context.actor.userId,
          },
          data: {
            jdHistoryId: null,
          },
        });

        await tx.jDHistory.delete({
          where: { id: jdId },
        });

        return null;
      },
    );

    return { deleted: true, id: jdId };
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
        status: { not: "deleted" },
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
        experienceLevel:
          (jdRecord.experienceLevel as ParsedJdContentDto["experienceLevel"]) ??
          "unknown",
        roleType:
          (jdRecord.roleType as ParsedJdContentDto["roleType"]) ?? "unknown",
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
          parsedKeywords: JSON.parse(
            JSON.stringify(parsedJd.keywords),
          ) as JsonValue,
          parsedRequirements: JSON.parse(
            JSON.stringify(parsedJd.requirements),
          ) as JsonValue,
          parsedResponsibilities: JSON.parse(
            JSON.stringify(parsedJd.responsibilities),
          ) as JsonValue,
          experienceLevel: parsedJd.experienceLevel,
          roleType: parsedJd.roleType,
        },
      });
      jdHistoryId = newJd.id;
    } else {
      throw new ResumeError(
        "invalid_input",
        "Either jdHistoryId or rawJD must be provided",
      );
    }

    const rawContent = resume.content ?? resume.versions[0]?.content;
    const resumeContent = (rawContent ??
      {}) as unknown as ParsedResumeContentDto;

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
            atsBreakdown: JSON.parse(
              JSON.stringify(atsBreakdown),
            ) as JsonObject,
            jdHistoryId,
          },
        });

        if (resume.versions[0]) {
          await tx.resumeVersion.update({
            where: { id: resume.versions[0].id },
            data: {
              atsScore: atsBreakdown.overallScore,
              atsBreakdown: JSON.parse(
                JSON.stringify(atsBreakdown),
              ) as JsonObject,
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

  /**
   * Generates a basic or JD-tailored resume from the user's master profile facts.
   * Adheres strictly to F06 invariants: never invents qualifications, preserves fact provenance.
   */
  async function generateResumeFromProfile(
    context: ResumeServiceContext,
    input: ResumeGenerateInput = {},
  ): Promise<ResumeDetailDto> {
    const parsedInput = resumeGenerateRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    const data = parsedInput.data;
    const workspace = await authorizeWorkspace(context, "resume.create");

    // Fetch user profile with all relevant sections
    let profile = await db.userProfile.findUnique({
      where: { userId: context.actor.userId },
      include: {
        contact: true,
        experiences: { orderBy: { sortOrder: "asc" } },
        educations: { orderBy: { sortOrder: "asc" } },
        skills: { orderBy: { name: "asc" } },
        projects: { orderBy: { name: "asc" } },
        certifications: { orderBy: { name: "asc" } },
      },
    });

    if (!profile) {
      // Create minimal profile if not present yet
      const newProfile = await db.userProfile.create({
        data: {
          userId: context.actor.userId,
          fullName: "User",
        },
        include: {
          contact: true,
          experiences: { orderBy: { sortOrder: "asc" } },
          educations: { orderBy: { sortOrder: "asc" } },
          skills: { orderBy: { name: "asc" } },
          projects: { orderBy: { name: "asc" } },
          certifications: { orderBy: { name: "asc" } },
        },
      });
      profile = newProfile;
    }

    const mappedContent = mapProfileToResume(profile, data.title);

    let atsScore: number | null = null;
    let atsBreakdown: JsonObject | undefined = undefined;
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
        throw new ResumeError("not_found", "Job description not found");
      }
      const parsedJd: ParsedJdContentDto = {
        jobTitle: jdRecord.jobTitle,
        company: jdRecord.company,
        experienceLevel:
          (jdRecord.experienceLevel as ParsedJdContentDto["experienceLevel"]) ??
          "unknown",
        roleType:
          (jdRecord.roleType as ParsedJdContentDto["roleType"]) ?? "unknown",
        keywords: toKeywords(jdRecord.parsedKeywords),
        requirements: toStringArray(jdRecord.parsedRequirements),
        responsibilities: toStringArray(jdRecord.parsedResponsibilities),
      };
      const breakdown = computeAtsScore(mappedContent, parsedJd);
      atsScore = breakdown.overallScore;
      atsBreakdown = JSON.parse(JSON.stringify(breakdown)) as JsonObject;
      jdHistoryId = jdRecord.id;
    }

    const resumeId = randomUUID();
    const versionId = randomUUID();

    const auditIntent = createAuditIntent(context, "resume.created", resumeId, {
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
            id: resumeId,
            profileId: profile.id,
            ownerUserId: context.actor.userId,
            workspaceType: "individual",
            workspaceId: workspace.id,
            createdByUserId: context.actor.userId,
            templateId: data.templateId,
            content: JSON.parse(JSON.stringify(mappedContent)) as JsonObject,
            status: "draft",
            currentVersion: 1,
            atsScore,
            atsBreakdown,
            jdHistoryId,
          },
        });

        await tx.resumeVersion.create({
          data: {
            id: versionId,
            resumeId,
            versionNumber: 1,
            content: JSON.parse(JSON.stringify(mappedContent)) as JsonObject,
            createdByUserId: context.actor.userId,
            atsScore,
            atsBreakdown,
          },
        });

        return resumeRecord;
      },
    );

    return {
      id: created.id,
      profileId: created.profileId,
      workspaceId: created.workspaceId,
      title: mappedContent.title,
      templateId: created.templateId,
      currentVersion: created.currentVersion,
      status: created.status,
      atsScore: created.atsScore,
      content: mappedContent,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Produces a reviewable section or bullet rewrite suggestion grounded in profile facts.
   * Tracks task execution in TaskRun table. Never alters the resume directly.
   */
  async function generateSectionSuggestionForResume(
    context: ResumeServiceContext,
    resumeId: string,
    input: ResumeSuggestRequest,
  ): Promise<ResumeSuggestionDto> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    const parsedInput = resumeSuggestRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    const data = parsedInput.data;
    await authorizeWorkspace(context, "resume.read");

    const resume = await db.resume.findFirst({
      where: {
        status: { not: "deleted" },
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

    const rawContent = resume.content ?? resume.versions[0]?.content;
    const resumeContent = (rawContent ??
      {}) as unknown as ParsedResumeContentDto;

    // Locate target content to improve
    let originalContent = "";
    if (data.sectionKind === "summary") {
      const summarySec = resumeContent.sections.find(
        (s) => s.kind === "summary",
      );
      originalContent = summarySec?.summary ?? "";
    } else if (data.sectionKind === "experience") {
      const expSec = resumeContent.sections.find(
        (s) => s.kind === "experience",
      );
      if (expSec) {
        if (data.entryId) {
          const entry = expSec.entries.find((e) => e["id"] === data.entryId);
          if (entry) {
            const rawBullets = Array.isArray(entry["bullets"])
              ? entry["bullets"]
              : [];
            const bullets: Record<string, unknown>[] = rawBullets.filter(
              (bp): bp is Record<string, unknown> =>
                typeof bp === "object" && bp !== null,
            );
            if (data.bulletId) {
              const b = bullets.find((bp) => bp["id"] === data.bulletId);
              originalContent =
                typeof b?.["text"] === "string" ? b["text"] : "";
            } else {
              originalContent =
                typeof entry["description"] === "string" && entry["description"]
                  ? entry["description"]
                  : typeof entry["title"] === "string"
                    ? entry["title"]
                    : "";
            }
          }
        } else if (expSec.entries.length > 0) {
          const first = expSec.entries[0];
          const rawBullets = Array.isArray(first?.["bullets"])
            ? first["bullets"]
            : [];
          const firstBullet: unknown = rawBullets[0];
          originalContent =
            typeof firstBullet === "object" &&
            firstBullet !== null &&
            typeof (firstBullet as Record<string, unknown>)["text"] === "string"
              ? ((firstBullet as Record<string, unknown>)["text"] as string)
              : "";
        }
      }
    } else if (data.sectionKind === "projects") {
      const projSec = resumeContent.sections.find((s) => s.kind === "projects");
      if (projSec && projSec.entries.length > 0) {
        const first = projSec.entries[0];
        originalContent =
          typeof first?.["description"] === "string"
            ? first["description"]
            : "";
      }
    } else {
      const skillSec = resumeContent.sections.find((s) => s.kind === "skills");
      if (skillSec && skillSec.groups.length > 0) {
        originalContent =
          skillSec.groups[0]?.items.map((i) => i.text).join(", ") ?? "";
      }
    }

    if (!originalContent.trim()) {
      originalContent =
        "Experienced professional delivering high impact solutions across software projects.";
    }

    // Load profile skills for grounding
    const profileSkills = await db.skill.findMany({
      where: { profile: { userId: context.actor.userId } },
      select: { name: true },
    });
    const knownSkills = profileSkills.map((s) => s.name);

    // Load target JD keywords if specified
    const jdKeywords: string[] = [];
    if (data.jdHistoryId) {
      const jd = await db.jDHistory.findFirst({
        where: {
          id: data.jdHistoryId,
          createdByUserId: context.actor.userId,
          workspaceId: context.actor.personalWorkspaceId,
        },
      });
      if (jd) {
        const parsedKws = toKeywords(jd.parsedKeywords);
        jdKeywords.push(...parsedKws.map((k) => k.name));
      }
    }

    const suggestion = generateSectionSuggestion({
      originalContent,
      action: data.action,
      sectionKind: data.sectionKind,
      profileSkills: knownSkills,
      jdKeywords,
      customPrompt: data.customPrompt,
    });

    const taskRunId = randomUUID();

    // Persist TaskRun
    await db.taskRun.create({
      data: {
        id: taskRunId,
        profileId: resume.profileId,
        workspaceType: "individual",
        workspaceId: context.actor.personalWorkspaceId,
        userId: context.actor.userId,
        resumeId,
        kind: "section_suggestion",
        dispatchStatus: "completed",
        inputRevisions: JSON.parse(
          JSON.stringify({
            result: suggestion,
            action: data.action,
            sectionKind: data.sectionKind,
          }),
        ) as JsonObject,
      },
    });

    return {
      taskRunId,
      suggestionId: suggestion.suggestionId,
      sectionKind: data.sectionKind,
      entryId: data.entryId ?? null,
      bulletId: data.bulletId ?? null,
      originalContent: suggestion.originalContent,
      suggestedContent: suggestion.suggestedContent,
      reasoning: suggestion.reasoning,
      groundedKeywords: suggestion.groundedKeywords,
      status: "pending_review",
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Applies an approved suggestion to a resume version, incrementing version number transactionally.
   * Enforces strict optimistic concurrency control (expectedVersion) and single-resume isolation.
   */
  async function applySectionSuggestion(
    context: ResumeServiceContext,
    resumeId: string,
    input: ResumeApplySuggestion,
  ): Promise<ResumeDetailDto> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    const parsedInput = resumeApplySuggestionSchema.safeParse(input);
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
      status: "draft",
      reasonCode: "apply_suggestion",
    });

    const updated = await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      auditIntent,
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${resumeId}))`;
        const existing = await tx.resume.findFirst({
          where: {
            status: { not: "deleted" },
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

        if (!existing) {
          throw new ResumeError("not_found", "Resume not found");
        }

        if (existing.currentVersion !== data.expectedVersion) {
          throw new ResumeError("revision_conflict", "Resume version conflict");
        }

        const rawContent = existing.content ?? existing.versions[0]?.content;
        const content = JSON.parse(
          JSON.stringify(rawContent ?? {}),
        ) as ParsedResumeContentDto;

        // Apply suggestion to target location
        if (data.sectionKind === "summary") {
          let summarySec = content.sections.find((s) => s.kind === "summary");
          if (!summarySec) {
            summarySec = {
              id: randomUUID(),
              kind: "summary",
              label: "Professional Summary",
              hidden: false,
              summary: data.appliedContent,
              entries: [],
              groups: [],
            };
            content.sections.unshift(summarySec);
          } else {
            summarySec.summary = data.appliedContent;
          }
        } else if (data.sectionKind === "experience") {
          const expSec = content.sections.find((s) => s.kind === "experience");
          if (expSec) {
            if (data.entryId) {
              const entry = expSec.entries.find(
                (e) => e["id"] === data.entryId,
              );
              if (entry) {
                if (data.bulletId && Array.isArray(entry["bullets"])) {
                  const b = (
                    entry["bullets"] as Array<Record<string, unknown>>
                  ).find((bp) => bp["id"] === data.bulletId);
                  if (b) {
                    b["text"] = data.appliedContent;
                  }
                } else {
                  entry["description"] = data.appliedContent;
                }
              }
            } else if (expSec.entries.length > 0) {
              const first = expSec.entries[0];
              if (
                first &&
                Array.isArray(first["bullets"]) &&
                first["bullets"].length > 0
              ) {
                const b0: unknown = first["bullets"][0];
                if (typeof b0 === "object" && b0 !== null) {
                  (b0 as Record<string, unknown>)["text"] = data.appliedContent;
                }
              } else if (first) {
                first["description"] = data.appliedContent;
              }
            }
          }
        }

        const newVersionNumber = existing.currentVersion + 1;

        await tx.resumeVersion.create({
          data: {
            id: versionId,
            resumeId,
            versionNumber: newVersionNumber,
            content: JSON.parse(JSON.stringify(content)) as JsonObject,
            createdByUserId: context.actor.userId,
            atsScore: existing.atsScore,
            atsBreakdown: existing.atsBreakdown
              ? (existing.atsBreakdown as JsonObject)
              : undefined,
          },
        });

        const updatedResume = await tx.resume.update({
          where: { id: resumeId, currentVersion: data.expectedVersion },
          data: {
            currentVersion: newVersionNumber,
            atsScore: null,
            pdfR2Key: null,
            content: JSON.parse(JSON.stringify(content)) as JsonObject,
          },
        });

        return updatedResume;
      },
    );

    const rawUpdatedContent =
      updated.content as unknown as ParsedResumeContentDto;

    return {
      id: updated.id,
      profileId: updated.profileId,
      workspaceId: updated.workspaceId,
      title: rawUpdatedContent.title || "Resume",
      templateId: updated.templateId,
      currentVersion: updated.currentVersion,
      status: updated.status,
      atsScore: updated.atsScore,
      content: rawUpdatedContent,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves a TaskRun record by ID ensuring strict actor and workspace isolation.
   */
  async function getTaskRunById(
    context: ResumeServiceContext,
    taskRunId: string,
  ): Promise<TaskRunDto> {
    if (!z.string().uuid().safeParse(taskRunId).success) {
      throw new ResumeError("invalid_input", "Invalid task run ID");
    }
    await authorizeWorkspace(context, "resume.read");

    const record = await db.taskRun.findFirst({
      where: {
        id: taskRunId,
        userId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      },
    });

    if (!record) {
      throw new ResumeError("not_found", "Task run not found");
    }

    const revisions = record.inputRevisions as Record<string, unknown> | null;
    const result =
      (revisions?.result
        ? (revisions.result as Record<string, unknown>)
        : revisions) ?? null;

    return {
      id: record.id,
      kind: record.kind,
      dispatchStatus: record.dispatchStatus,
      taskType: record.kind,
      status: record.dispatchStatus,
      result,
      errorMessage: record.errorCode,
      resumeId: record.resumeId,
      createdAt: record.createdAt.toISOString(),
      completedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * Performs Keyword & Skill Gap Analysis (F17) comparing a Resume and a Job Description,
   * grounded against master profile facts. Invariant: never mutates profile or resume,
   * never invents qualifications, and never leaks UserContact.
   */
  async function analyzeResumeGap(
    context: ResumeServiceContext,
    resumeId: string,
    input: GapAnalysisRequest = {},
  ): Promise<GapAnalysisResultDto> {
    if (!z.string().uuid().safeParse(resumeId).success) {
      throw new ResumeError("invalid_input", "Invalid resume ID");
    }
    const parsedInput = gapAnalysisRequestSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new ResumeError(
        "invalid_input",
        parsedInput.error.errors.map((e) => e.message).join(", "),
      );
    }
    const data = parsedInput.data;
    await authorizeWorkspace(context, "skillgap.analyze");

    // Fetch resume with latest version
    const resume = await db.resume.findFirst({
      where: {
        status: { not: "deleted" },
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
    let jobTitle: string | null;
    let company: string | null;

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
        experienceLevel:
          (jdRecord.experienceLevel as ParsedJdContentDto["experienceLevel"]) ??
          "unknown",
        roleType:
          (jdRecord.roleType as ParsedJdContentDto["roleType"]) ?? "unknown",
        keywords: toKeywords(jdRecord.parsedKeywords),
        requirements: toStringArray(jdRecord.parsedRequirements),
        responsibilities: toStringArray(jdRecord.parsedResponsibilities),
      };
      jdHistoryId = jdRecord.id;
      jobTitle = jdRecord.jobTitle;
      company = jdRecord.company;
    } else if (data.rawJD) {
      parsedJd = parseJdText(data.rawJD);
      jobTitle = parsedJd.jobTitle;
      company = parsedJd.company;
    } else if (resume.jdHistoryId) {
      const jdRecord = await db.jDHistory.findFirst({
        where: {
          id: resume.jdHistoryId,
          createdByUserId: context.actor.userId,
          workspaceId: context.actor.personalWorkspaceId,
        },
      });
      if (jdRecord) {
        parsedJd = {
          jobTitle: jdRecord.jobTitle,
          company: jdRecord.company,
          experienceLevel:
            (jdRecord.experienceLevel as ParsedJdContentDto["experienceLevel"]) ??
            "unknown",
          roleType:
            (jdRecord.roleType as ParsedJdContentDto["roleType"]) ?? "unknown",
          keywords: toKeywords(jdRecord.parsedKeywords),
          requirements: toStringArray(jdRecord.parsedRequirements),
          responsibilities: toStringArray(jdRecord.parsedResponsibilities),
        };
        jdHistoryId = jdRecord.id;
        jobTitle = jdRecord.jobTitle;
        company = jdRecord.company;
      } else {
        throw new ResumeError(
          "invalid_input",
          "Linked job description no longer exists. Provide a valid jdHistoryId or rawJD.",
        );
      }
    } else {
      throw new ResumeError(
        "invalid_input",
        "A job description (jdHistoryId or rawJD) is required for gap analysis.",
      );
    }

    // Fetch master profile facts (strictly omitting UserContact)
    const profile = await db.userProfile.findUnique({
      where: { userId: context.actor.userId },
      include: {
        experiences: { orderBy: { sortOrder: "asc" } },
        educations: { orderBy: { sortOrder: "asc" } },
        skills: { orderBy: { name: "asc" } },
        projects: { orderBy: { name: "asc" } },
        certifications: { orderBy: { name: "asc" } },
      },
    });

    const masterProfileFacts = {
      id: profile?.id ?? randomUUID(),
      fullName: profile?.fullName ?? undefined,
      location: profile?.location ?? null,
      professionalSummary: profile?.professionalSummary ?? null,
      revision: profile?.revision ?? 0,
      experiences: (profile?.experiences ?? []).map((e) => ({
        id: e.id,
        company: e.company,
        title: e.title,
        bulletPoints: Array.isArray(e.bulletPoints)
          ? (e.bulletPoints as string[])
          : [],
      })),
      educations: (profile?.educations ?? []).map((e) => ({
        id: e.id,
        institution: e.institution,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        description: e.description,
      })),
      skills: (profile?.skills ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        proficiency: s.proficiency,
      })),
      projects: (profile?.projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        technologies: Array.isArray(p.technologies)
          ? (p.technologies as string[])
          : [],
      })),
      certifications: (profile?.certifications ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuer,
      })),
    };

    const rawContent = resume.content ?? resume.versions[0]?.content;
    const resumeContent = (rawContent ??
      {}) as unknown as ParsedResumeContentDto;
    const resumeTitle = resumeContent.title || "Untitled Resume";

    return analyzeKeywordGaps(resumeContent, parsedJd, masterProfileFacts, {
      resumeId: resume.id,
      resumeTitle,
      resumeVersion: resume.currentVersion,
      profileRevision: profile?.revision ?? 0,
      jdHistoryId,
      jobTitle,
      company,
    });
  }

  return {
    importResume,
    authorizeUpload: (context: ResumeServiceContext) =>
      authorizeWorkspace(context, "resume.create"),
    createResume,
    parseResumeOnly,
    getResumeById,
    listResumes,
    updateResume,
    deleteResume,
    removeResume,
    restoreResume,
    downloadPdf,
    downloadResume,
    listResumeVersions,
    cloneResume,
    parseJdOnly,
    parseAndSaveJD,
    getJDHistoryById,
    listJDHistories,
    deleteJDHistory,
    tailorResume,
    generateResumeFromProfile,
    generateSectionSuggestion: generateSectionSuggestionForResume,
    applySectionSuggestion,
    getTaskRunById,
    analyzeResumeGap,
  };
}
