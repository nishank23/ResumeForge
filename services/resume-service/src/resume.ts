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
  type ResumeImportRequest,
  type ResumeParseRequest,
  type ParsedResumeContentDto,
  type ResumeDetailDto,
  type ResumeSummaryDto,
} from "./contracts.js";
import { extractTextFromFile } from "./extractor.js";
import { parseResumeText } from "./parser.js";

type Database = ReturnType<typeof createDatabaseClient>;

type JsonObject = { [Key in string]?: JsonValue | null };
type JsonArray = (JsonValue | null)[];
type JsonValue = string | number | boolean | JsonObject | JsonArray;

export interface ResumeServiceContext {
  actor: ResolvedActor;
  selectedWorkspaceId?: string;
  correlationId: string;
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

  return {
    importResume,
    parseResumeOnly,
    getResumeById,
    listResumes,
  };
}
