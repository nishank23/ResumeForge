import { createHash } from "node:crypto";
import { z } from "zod";
import {
  editorDocumentSchema,
  readabilityEvaluationSchema,
  readabilityRequestSchema,
  type ReadabilityAnalysis,
  type EditorDocument,
} from "@resume-forge/shared-types";
import {
  withPersonalAuditTransaction,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import type { AuditEventIntent } from "@resume-forge/audit-contracts";
import type { ResumeServiceContext } from "./resume.js";
import { ResumeError } from "./contracts.js";
import { inspectSavedResumePdf } from "./pdf.js";

type Database = ReturnType<typeof createDatabaseClient>;
type Json = Parameters<Database["resume"]["update"]>[0]["data"]["atsBreakdown"];
const hash = (doc: EditorDocument) =>
  createHash("sha256").update(JSON.stringify(doc)).digest("hex");
const metadata = (value: unknown) =>
  value == null ? {} : z.record(z.unknown()).parse(value);
export function createReadabilityUseCases(options: {
  db: Database;
  now: () => number;
  authorize: (
    context: ResumeServiceContext,
    permission: "resume.read" | "resume.download",
  ) => Promise<unknown>;
  assert: (context: ResumeServiceContext) => void;
  audit: (
    context: ResumeServiceContext,
    action: AuditEventIntent["action"],
    id: string,
    metadata?: AuditEventIntent["metadata"],
  ) => AuditEventIntent;
  inspect?: (doc: EditorDocument) => Promise<ReadabilityAnalysis>;
}) {
  const {
    db,
    now,
    authorize,
    audit,
    assert: assertActor,
    inspect = inspectSavedResumePdf,
  } = options;
  const where = (context: ResumeServiceContext, id: string) => ({
    id,
    ownerUserId: context.actor.userId,
    workspaceId: context.actor.personalWorkspaceId,
    status: { not: "deleted" },
  });
  async function base(
    context: ResumeServiceContext,
    id: string,
    version?: number,
  ) {
    if (!z.string().uuid().safeParse(id).success)
      throw new ResumeError("invalid_input");
    await authorize(context, "resume.read");
    // Extracted text includes private owner header/contact fields, like the PDF.
    await authorize(context, "resume.download");
    const resume = await db.resume.findFirst({ where: where(context, id) });
    if (!resume) throw new ResumeError("not_found");
    if (version !== undefined && resume.currentVersion !== version)
      throw new ResumeError("revision_conflict");
    const snapshot = await db.resumeVersion.findUnique({
      where: {
        resumeId_versionNumber: {
          resumeId: id,
          versionNumber: resume.currentVersion,
        },
      },
    });
    if (
      !snapshot ||
      snapshot.resumeId !== id ||
      snapshot.versionNumber !== resume.currentVersion
    )
      throw new ResumeError("not_found");
    const doc = editorDocumentSchema.safeParse(
      metadata(snapshot.content).editorDraft,
    );
    if (!doc.success)
      throw new ResumeError(
        "invalid_input",
        "Reopen and save this resume before checking the PDF.",
      );
    assertActor(context);
    return { resume, snapshot, doc: doc.data, documentHash: hash(doc.data) };
  }
  function cached(
    value: unknown,
    id: string,
    versionId: string,
    version: number,
    documentHash: string,
  ) {
    const result = readabilityEvaluationSchema.safeParse(
      metadata(value).pdfReadability,
    );
    return result.success &&
      result.data.resumeId === id &&
      result.data.versionId === versionId &&
      result.data.resumeVersion === version &&
      result.data.documentHash === documentHash
      ? result.data
      : null;
  }
  async function getReadability(context: ResumeServiceContext, id: string) {
    const { resume, snapshot, documentHash } = await base(context, id);
    return {
      currentVersion: resume.currentVersion,
      evaluation: cached(
        resume.atsBreakdown,
        id,
        snapshot.id,
        resume.currentVersion,
        documentHash,
      ),
    };
  }
  async function runReadability(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ) {
    const request = readabilityRequestSchema.safeParse(input);
    if (!request.success) throw new ResumeError("invalid_input");
    const { resume, snapshot, doc, documentHash } = await base(
      context,
      id,
      request.data.expectedVersion,
    );
    const previous = cached(
      resume.atsBreakdown,
      id,
      snapshot.id,
      resume.currentVersion,
      documentHash,
    );
    if (previous)
      return { currentVersion: resume.currentVersion, evaluation: previous };
    const analysis = await inspect(doc);
    // Rendering/extraction is outside the transaction. Recheck all authority.
    await authorize(context, "resume.read");
    await authorize(context, "resume.download");
    assertActor(context);
    const evaluation = readabilityEvaluationSchema.parse({
      resumeId: id,
      versionId: snapshot.id,
      resumeVersion: resume.currentVersion,
      documentHash,
      checkedAt: new Date(now()).toISOString(),
      analysis,
    });
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      audit(context, "resume.updated", id, {
        versionId: snapshot.id,
        status: "succeeded",
        reasonCode: "pdf_readability_checked",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        assertActor(context);
        const current = await tx.resume.findFirst({
          where: where(context, id),
        });
        if (!current) throw new ResumeError("not_found");
        if (current.currentVersion !== request.data.expectedVersion)
          throw new ResumeError("revision_conflict");
        const replay = cached(
          current.atsBreakdown,
          id,
          snapshot.id,
          current.currentVersion,
          documentHash,
        );
        if (replay)
          return { currentVersion: current.currentVersion, evaluation: replay };
        const json = JSON.stringify({
          ...metadata(current.atsBreakdown),
          pdfReadability: evaluation,
        });
        if (Buffer.byteLength(json) > 2_000_000)
          throw new ResumeError(
            "invalid_input",
            "Retained resume metadata limit reached.",
          );
        await tx.resume.update({
          where: { id },
          data: { atsBreakdown: JSON.parse(json) as Json },
        });
        return { currentVersion: current.currentVersion, evaluation };
      },
    );
  }
  return { getReadability, runReadability };
}
