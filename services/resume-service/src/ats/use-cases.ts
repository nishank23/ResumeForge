import { GEMINI_MODEL } from "./ai.js";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { computeJdMatch, readinessProjection } from "@resume-forge/resume-core";
import {
  editorDocumentSchema,
  jdEvaluationSchema,
  jdRunSchema,
  jdPreferenceSchema,
  rewriteRequestSchema,
  rewriteProposalSchema,
  rewriteApplySchema,
  type JdState,
  type RewriteProposal,
} from "@resume-forge/shared-types";
import {
  withPersonalAuditTransaction,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import type { AuditEventIntent } from "@resume-forge/audit-contracts";
import type { ResumeServiceContext } from "../resume.js";
import {
  EMBEDDING_MODEL,
  vectorChunks,
  vectorCache,
  saveVectorChunks,
  retrieveVectorEvidence,
} from "./vectors.js";
import { ResumeError } from "../contracts.js";
import { parseJdText } from "../jd-parser.js";
import { createAiProviders, type AiProviders } from "./ai.js";
import {
  applyRewrite,
  assertContactFree,
  plain,
  rewriteFields,
  validateChanges,
} from "./rewrite.js";
type Database = ReturnType<typeof createDatabaseClient>;
type Json = Parameters<Database["resume"]["update"]>[0]["data"]["atsBreakdown"];
const historySchema = z
  .object({
    evaluations: z.array(jdEvaluationSchema).max(100),
    dismissed: z.array(z.string().max(400)).max(100),
  })
  .strict();
const proposalsSchema = z.array(rewriteProposalSchema).max(100);
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function createAtsUseCases(options: {
  db: Database;
  now: () => number;
  authorize: (
    context: ResumeServiceContext,
    permission:
      | "ats.run"
      | "ats.view"
      | "resume.read"
      | "resume.update"
      | "resume.generate",
  ) => Promise<unknown>;
  assert: (context: ResumeServiceContext) => void;
  audit: (
    context: ResumeServiceContext,
    action: AuditEventIntent["action"],
    id: string,
    metadata?: AuditEventIntent["metadata"],
  ) => AuditEventIntent;
  providers?: AiProviders;
}) {
  const { db, now, authorize, assert: assertActor, audit } = options;
  const providers =
    options.providers ?? createAiProviders({ paidGemini: false });
  const where = (context: ResumeServiceContext, id: string) => ({
    id,
    ownerUserId: context.actor.userId,
    workspaceId: context.actor.personalWorkspaceId,
    status: { not: "deleted" },
  });
  const root = (value: unknown) =>
    value == null ? {} : z.record(z.unknown()).parse(value);
  const history = (value: unknown) =>
    historySchema.parse(
      root(value).jdMatching ?? { evaluations: [], dismissed: [] },
    );
  const proposals = (value: unknown) =>
    proposalsSchema.parse(root(value).rewrites ?? []);
  function metadata(value: unknown): Json {
    const text = JSON.stringify(value);
    if (text.length > 2_000_000)
      throw new ResumeError(
        "invalid_input",
        "Retained ATS metadata limit reached.",
      );
    return JSON.parse(text) as Json;
  }
  async function base(
    context: ResumeServiceContext,
    id: string,
    version?: number,
  ) {
    if (!z.string().uuid().safeParse(id).success)
      throw new ResumeError("invalid_input");
    await authorize(context, "resume.read");
    const resume = await db.resume.findFirst({ where: where(context, id) });
    if (!resume) throw new ResumeError("not_found");
    if (version !== undefined && resume.currentVersion !== version)
      throw new ResumeError(
        "revision_conflict",
        "Save or reopen the latest resume before ATS or AI actions.",
      );
    const snapshot = await db.resumeVersion.findUnique({
      where: {
        resumeId_versionNumber: {
          resumeId: id,
          versionNumber: resume.currentVersion,
        },
      },
    });
    if (!snapshot) throw new ResumeError("not_found");
    const content = z.record(z.unknown()).parse(snapshot.content);
    const doc = editorDocumentSchema.parse(content.editorDraft);
    assertActor(context);
    return { resume, snapshot, doc, content };
  }
  function state(version: number, value: unknown): JdState {
    const h = history(value);
    return {
      currentVersion: version,
      evaluation: h.evaluations.at(-1) ?? null,
      dismissed: h.dismissed,
      geminiAvailable: providers.geminiAvailable,
    };
  }
  async function getJdMatch(context: ResumeServiceContext, id: string) {
    await authorize(context, "ats.view");
    const b = await base(context, id);
    return state(b.resume.currentVersion, b.resume.atsBreakdown);
  }
  async function runJdMatch(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ) {
    const request = jdRunSchema.safeParse(input);
    if (!request.success)
      throw new ResumeError(
        "invalid_input",
        "Paste a JD between 50 and 12,000 characters.",
      );
    await authorize(context, "ats.run");
    const r = request.data;
    if (r.semantic && !r.consent)
      throw new ResumeError(
        "invalid_input",
        "Confirm sending professional facts and JD responsibilities to Gemini.",
      );
    const b = await base(context, id, r.expectedVersion);
    const parsed = parseJdText(r.jdText);
    const projection = readinessProjection(b.doc);
    // Technology labels contribute to matching, never description-length or clarity checks.
    const technologies = projection.sections.flatMap((s) =>
      s.entries.flatMap((e) => {
        const text = b.doc.sections
          .find((v) => v.id === s.id)
          ?.entries.find((v) => v.id === e.id)
          ?.technologies.trim();
        return text ? [{ sectionId: s.id, itemId: e.id, text }] : [];
      }),
    );
    const inputHash = hash({ projection, technologies }),
      jdHash = hash(r.jdText);
    const previous = history(b.resume.atsBreakdown).evaluations.at(-1);
    if (
      previous?.resumeVersion === r.expectedVersion &&
      previous.inputHash === inputHash &&
      previous.jdHash === jdHash &&
      previous.analysis === (r.semantic ? "gemini" : "local") &&
      (!r.semantic ||
        (previous.retrieval !== undefined && previous.model === GEMINI_MODEL))
    )
      return state(b.resume.currentVersion, b.resume.atsBreakdown);
    const requirements = parsed.responsibilities.slice(0, 30);
    const entries = projection.sections
      .filter((s) => ["experience", "projects"].includes(s.kind))
      .flatMap((s) =>
        s.entries.map((e) => ({
          sectionId: s.id,
          itemId: e.id,
          details: [
            ...e.details,
            ...technologies
              .filter((t) => t.sectionId === s.id && t.itemId === e.id)
              .map((t) => t.text),
          ],
        })),
      );
    if (r.semantic) {
      assertContactFree(JSON.stringify({ requirements, entries }), b.doc);
    }
    let selectedEntries = entries;
    let retrieval:
      | {
          model: typeof EMBEDDING_MODEL;
          dimensions: 768;
          indexedChunks: number;
          reusedChunks: number;
          hits: {
            requirement: string;
            sectionId: string;
            itemId: string;
            similarity: number;
          }[];
        }
      | undefined;
    if (r.semantic) {
      if (!providers.geminiAvailable)
        throw new ResumeError(
          "invalid_input",
          "Configure paid Gemini before semantic analysis.",
        );
      const scope = {
        resumeId: id,
        versionId: b.snapshot.id,
        ownerUserId: context.actor.userId,
        workspaceId: context.actor.personalWorkspaceId,
      };
      const chunks = vectorChunks(entries),
        missing = await vectorCache(db, scope, chunks);
      // Explicit analysis consent covers Gemini embedding egress and private derived storage.
      await withPersonalAuditTransaction(
        db,
        context.actor.userId,
        audit(context, "resume.updated", id, {
          reasonCode: "vector_analysis_requested",
        }),
        () => {
          assertActor(context);
          return Promise.resolve();
        },
      );
      const vectors = await providers.embed([
        ...missing.map((c) => ({ text: c.text, query: false })),
        ...requirements.map((text) => ({ text, query: true })),
      ]);
      await authorize(context, "ats.run");
      await withPersonalAuditTransaction(
        db,
        context.actor.userId,
        audit(context, "resume.updated", id, { reasonCode: "vector_indexed" }),
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
          assertActor(context);
          const current = await tx.resume.findFirst({
            where: where(context, id),
          });
          if (!current) throw new ResumeError("not_found");
          if (current.currentVersion !== r.expectedVersion)
            throw new ResumeError(
              "revision_conflict",
              "Resume changed during indexing. Recheck the latest saved version.",
            );
          await saveVectorChunks(
            tx,
            scope,
            missing,
            vectors.slice(0, missing.length),
          );
        },
      );
      const found = await retrieveVectorEvidence(
        db,
        scope,
        requirements,
        vectors.slice(missing.length),
        entries,
      );
      selectedEntries = found.entries;
      retrieval = {
        model: EMBEDDING_MODEL,
        dimensions: 768,
        indexedChunks: chunks.length,
        reusedChunks: chunks.length - missing.length,
        hits: found.hits,
      };
    }
    const semantic =
      r.semantic && requirements.length && selectedEntries.length
        ? await providers.analyze(requirements, selectedEntries)
        : [];
    // Similarity ranks candidates only. Gemini must still quote supported source facts.
    const supportedSemantic = semantic.filter(
      (m) =>
        !retrieval ||
        retrieval.hits.some(
          (h) =>
            h.requirement === m.requirement &&
            h.sectionId === m.sectionId &&
            h.itemId === m.itemId,
        ),
    );
    await authorize(context, "ats.run");
    const evaluation = jdEvaluationSchema.parse({
      ...computeJdMatch(
        projection,
        {
          terms: parsed.keywords.slice(0, 100).map((k) => ({
            name: k.name,
            required: k.required,
            skill: ["technical", "tools", "soft_skills"].includes(k.category),
          })),
          responsibilities: requirements,
        },
        supportedSemantic,
        technologies,
      ),
      id: randomUUID(),
      resumeId: id,
      resumeVersion: r.expectedVersion,
      versionId: b.snapshot.id,
      inputHash,
      jdHash,
      jdText: r.jdText,
      evaluatedAt: new Date(now()).toISOString(),
      ...(retrieval ? { retrieval } : {}),
      analysis: r.semantic ? "gemini" : "local",
      model: r.semantic ? GEMINI_MODEL : null,
    });
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      audit(context, "resume.updated", id, {
        status: "succeeded",
        reasonCode: "jd_evaluated",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        assertActor(context);
        const current = await tx.resume.findFirst({
          where: where(context, id),
        });
        if (!current) throw new ResumeError("not_found");
        if (current.currentVersion !== r.expectedVersion)
          throw new ResumeError(
            "revision_conflict",
            "Resume changed during analysis. Save and recheck.",
          );
        const h = history(current.atsBreakdown);
        const last = h.evaluations.at(-1);
        if (
          last?.inputHash === inputHash &&
          last.jdHash === jdHash &&
          last.resumeVersion === r.expectedVersion &&
          last.analysis === evaluation.analysis &&
          last.model === evaluation.model &&
          (!r.semantic || last.retrieval !== undefined)
        )
          return state(current.currentVersion, current.atsBreakdown);
        if (h.evaluations.length >= 100)
          throw new ResumeError(
            "invalid_input",
            "Retained JD assessment limit reached.",
          );
        if (last?.jdHash !== jdHash) h.dismissed = [];
        h.evaluations.push(evaluation);
        const ids = new Set(
          evaluation.checks.filter((c) => !c.passed).map((c) => c.id),
        );
        h.dismissed = h.dismissed.filter((v) => ids.has(v));
        const meta = { ...root(current.atsBreakdown), jdMatching: h };
        await tx.resume.update({
          where: { id },
          data: { atsBreakdown: metadata(meta) },
        });
        return state(current.currentVersion, meta);
      },
    );
  }
  async function updateJdPreference(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ) {
    const r = jdPreferenceSchema.safeParse(input);
    if (!r.success) throw new ResumeError("invalid_input");
    await authorize(context, "ats.run");
    await base(context, id, r.data.expectedVersion);
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      audit(context, "resume.updated", id, {
        reasonCode: "jd_feedback_preference",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        assertActor(context);
        const current = await tx.resume.findFirst({
          where: where(context, id),
        });
        if (!current) throw new ResumeError("not_found");
        const h = history(current.atsBreakdown),
          last = h.evaluations.at(-1);
        if (
          current.currentVersion !== r.data.expectedVersion ||
          last?.resumeVersion !== r.data.expectedVersion ||
          last.id !== r.data.evaluationId
        )
          throw new ResumeError(
            "revision_conflict",
            "Recheck the latest saved version first.",
          );
        if (!last.checks.some((c) => c.id === r.data.issueId && !c.passed))
          throw new ResumeError("invalid_input");
        h.dismissed = h.dismissed.filter((v) => v !== r.data.issueId);
        if (r.data.dismissed) h.dismissed.push(r.data.issueId);
        const meta = { ...root(current.atsBreakdown), jdMatching: h };
        await tx.resume.update({
          where: { id },
          data: { atsBreakdown: metadata(meta) },
        });
        return state(current.currentVersion, meta);
      },
    );
  }
  async function requestRewrite(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ): Promise<RewriteProposal> {
    const r = rewriteRequestSchema.safeParse(input);
    if (!r.success)
      throw new ResumeError(
        "invalid_input",
        "Confirm provider processing and select a saved entry.",
      );
    await authorize(context, "resume.generate");
    await authorize(context, "resume.update");
    const b = await base(context, id, r.data.expectedVersion);
    const fields = rewriteFields(b.doc, r.data.target),
      inputHash = hash(fields),
      proposalId = randomUUID();
    // Audit the explicit request before any provider egress. No text or credentials in events.
    await withPersonalAuditTransaction(
      db,
      context.actor.userId,
      {
        ...audit(context, "resume.suggestion_requested", proposalId, {
          baseVersionId: b.snapshot.id,
        }),
        resourceType: "suggestion",
      },
      () => {
        assertActor(context);
        return Promise.resolve();
      },
    );
    const changes = validateChanges(
      b.doc,
      r.data.target,
      await providers.rewrite(fields),
    );
    await authorize(context, "resume.generate");
    await authorize(context, "resume.update");
    const proposal = rewriteProposalSchema.parse({
      id: proposalId,
      resumeId: id,
      resumeVersion: r.data.expectedVersion,
      versionId: b.snapshot.id,
      target: r.data.target,
      inputHash,
      createdAt: new Date(now()).toISOString(),
      model: GEMINI_MODEL,
      changes,
      appliedVersion: null,
    });
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      {
        ...audit(context, "resume.suggestion_ready", proposal.id, {
          suggestionId: proposal.id,
          baseVersionId: b.snapshot.id,
        }),
        resourceType: "suggestion",
      },
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        assertActor(context);
        const current = await tx.resume.findFirst({
          where: where(context, id),
        });
        if (!current) throw new ResumeError("not_found");
        if (current.currentVersion !== r.data.expectedVersion)
          throw new ResumeError(
            "revision_conflict",
            "Resume changed during the rewrite. Reopen and retry.",
          );
        const saved = proposals(current.atsBreakdown);
        if (saved.length >= 100)
          throw new ResumeError(
            "invalid_input",
            "Retained suggestion limit reached.",
          );
        saved.push(proposal);
        await tx.resume.update({
          where: { id },
          data: {
            atsBreakdown: metadata({
              ...root(current.atsBreakdown),
              rewrites: saved,
            }),
          },
        });
        return proposal;
      },
    );
  }
  async function applySavedRewrite(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ) {
    const r = rewriteApplySchema.safeParse(input);
    if (!r.success) throw new ResumeError("invalid_input");
    await authorize(context, "resume.update");
    await authorize(context, "resume.read");
    if (!z.string().uuid().safeParse(id).success)
      throw new ResumeError("invalid_input");
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      audit(context, "resume.updated", id, {
        suggestionId: r.data.proposalId,
        reasonCode: "apply_ai_rewrite",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        assertActor(context);
        const current = await tx.resume.findFirst({
          where: where(context, id),
        });
        if (!current) throw new ResumeError("not_found");
        const saved = proposals(current.atsBreakdown),
          proposal = saved.find((v) => v.id === r.data.proposalId);
        if (!proposal || proposal.resumeVersion !== r.data.expectedVersion)
          throw new ResumeError("not_found");
        if (proposal.appliedVersion) {
          if (current.currentVersion !== proposal.appliedVersion)
            throw new ResumeError("revision_conflict");
          return {
            currentVersion: proposal.appliedVersion,
            content: current.content,
          };
        }
        if (
          current.currentVersion !== r.data.expectedVersion ||
          now() - Date.parse(proposal.createdAt) > 30 * 60 * 1000
        )
          throw new ResumeError(
            "revision_conflict",
            "This suggestion is outdated. Request a new one.",
          );
        const snapshot = await tx.resumeVersion.findUnique({
          where: {
            resumeId_versionNumber: {
              resumeId: id,
              versionNumber: current.currentVersion,
            },
          },
        });
        if (!snapshot || snapshot.id !== proposal.versionId)
          throw new ResumeError("revision_conflict");
        const content = z.record(z.unknown()).parse(snapshot.content),
          doc = editorDocumentSchema.parse(content.editorDraft);
        if (hash(rewriteFields(doc, proposal.target)) !== proposal.inputHash)
          throw new ResumeError("revision_conflict");
        if (!proposal.changes.length)
          throw new ResumeError(
            "invalid_input",
            "There are no changes to apply.",
          );
        const next = applyRewrite(doc, proposal),
          versionId = randomUUID(),
          currentVersion = current.currentVersion + 1;
        const nextContent = {
          ...content,
          editorDraft: next,
          sections: next.sections.map((s) => ({
            ...s,
            summary: plain(s.summary),
            entries: s.entries.map((e) => ({
              ...e,
              description: plain(e.description),
            })),
          })),
        };
        proposal.appliedVersion = currentVersion;
        await tx.resumeVersion.create({
          data: {
            id: versionId,
            resumeId: id,
            versionNumber: currentVersion,
            content: JSON.parse(JSON.stringify(nextContent)) as Parameters<
              Database["resumeVersion"]["create"]
            >[0]["data"]["content"],
            createdByUserId: context.actor.userId,
          },
        });
        await tx.resume.update({
          where: { id, currentVersion: r.data.expectedVersion },
          data: {
            currentVersion,
            content: JSON.parse(JSON.stringify(nextContent)) as Parameters<
              Database["resumeVersion"]["create"]
            >[0]["data"]["content"],
            atsScore: null,
            pdfR2Key: null,
            atsBreakdown: metadata({
              ...root(current.atsBreakdown),
              rewrites: saved,
            }),
          },
        });
        return { currentVersion, content: nextContent };
      },
    );
  }
  return {
    getJdMatch,
    runJdMatch,
    updateJdPreference,
    requestRewrite,
    applySavedRewrite,
  };
}
