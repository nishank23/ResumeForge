import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { resolvedActorSchema } from "@resume-forge/access-policy/server";
import {
  withPersonalAuditTransaction,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import type { AuditEventIntent } from "@resume-forge/audit-contracts";
import {
  computeReadiness,
  readinessProjection,
} from "@resume-forge/resume-core";
import {
  applyTailoringPreview,
  editorDocumentSchema,
  tailoringRunSchema,
  tailoringStartSchema,
  tailoringCancelSchema,
  tailoringApplySchema,
  jdEvaluationSchema,
  readinessEvaluationSchema,
  type TailoringState,
} from "@resume-forge/shared-types";
import type { ResumeServiceContext } from "../resume.js";
import { ResumeError, type ResumeDetailDto } from "../contracts.js";
import {
  createAiProviders,
  AiUnavailable,
  TAILORING_MODEL,
  TAILORING_PROMPT_VERSION,
  type AiProviders,
} from "../ats/ai.js";
import { assertContactFree, plain } from "../ats/rewrite.js";
import {
  completeChanges,
  fieldBatches,
  groundedBatch,
  localAssessment,
  tailoringFields,
} from "./facts.js";
import {
  fullTailoringSource,
  fullTailoringOutputSchema,
  inspectFullDraft,
  verifiedFullChanges,
  tailoringVerificationSchema,
} from "./writer.js";

type Database = ReturnType<typeof createDatabaseClient>;
type Json = Parameters<Database["resume"]["update"]>[0]["data"]["atsBreakdown"];
const contextSchema = z
  .object({
    actor: resolvedActorSchema,
    selectedWorkspaceId: z.string().optional(),
    correlationId: z.string().uuid(),
  })
  .strict();
const storedSchema = z
  .object({
    run: tailoringRunSchema,
    context: contextSchema,
    versionId: z.string().uuid(),
    fingerprint: z.string(),
    copyId: z.string().uuid(),
    selectionHash: z.string().nullable(),
    lease: z.string().nullable(),
    leaseUntil: z.number(),
    attempts: z.number().int(),
    draft: fullTailoringOutputSchema.nullable().default(null),
    review: tailoringVerificationSchema.nullable().default(null),
  })
  .strict();
type Stored = z.infer<typeof storedSchema>;
const historySchema = z
  .object({ active: z.boolean(), runs: z.array(storedSchema).max(20) })
  .strict();
const root = (v: unknown) => z.record(z.unknown()).parse(v ?? {});
const history = (v: unknown) =>
  historySchema.parse(root(v).tailoring ?? { active: false, runs: [] });
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const pending = (v: Stored) => ["queued", "drafting"].includes(v.run.status);
function metadata(v: unknown): Json {
  const text = JSON.stringify(v);
  if (text.length > 2_000_000)
    throw new ResumeError("invalid_input", "Retained proposal limit reached.");
  return JSON.parse(text) as Json;
}
class Replay extends Error {}

/** Owned, version-bound queue in existing resume metadata. No extra runtime table grants. */
export function createTailoringUseCases(options: {
  db: Database;
  now: () => number;
  authorize: (
    context: ResumeServiceContext,
    permission: "resume.read" | "resume.create" | "resume.generate",
  ) => Promise<unknown>;
  assert: (context: ResumeServiceContext) => void;
  audit: (
    context: ResumeServiceContext,
    action: AuditEventIntent["action"],
    id: string,
    metadata?: AuditEventIntent["metadata"],
  ) => AuditEventIntent;
  providers?: AiProviders;
  getResume: (
    context: ResumeServiceContext,
    id: string,
  ) => Promise<ResumeDetailDto>;
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
        "Resume changed. Save or reopen it before tailoring.",
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
    const content = root(snapshot.content),
      doc = editorDocumentSchema.parse(content.editorDraft);
    assertActor(context);
    return { resume, snapshot, content, doc };
  }
  const state = (
    version: number,
    h: z.infer<typeof historySchema>,
  ): TailoringState => ({
    currentVersion: version,
    available: providers.rewriteAvailable,
    run: h.runs.at(-1)?.run ?? null,
  });
  async function getTailoring(context: ResumeServiceContext, id: string) {
    const b = await base(context, id);
    return state(b.resume.currentVersion, history(b.resume.atsBreakdown));
  }
  async function startTailoring(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ) {
    const r = tailoringStartSchema.parse(input);
    await authorize(context, "resume.generate");
    await authorize(context, "resume.create");
    const b = await base(context, id, r.expectedVersion);
    if (!providers.rewriteAvailable)
      throw new AiUnavailable(
        "Configure paid Gemini before full-resume tailoring.",
      );
    const source = fullTailoringSource(b.doc);
    const assessed = localAssessment(b.doc, r.jdText, now());
    // Provider scope contains professional prose and parsed JD context, never identity, dates or raw source files.
    assertContactFree(
      JSON.stringify({
        title: assessed.jd.jobTitle,
        terms: assessed.jd.keywords.map((k) => k.name),
        responsibilities: assessed.jd.responsibilities,
      }),
      b.doc,
    );
    if (!assessed.jd.keywords.length && !assessed.jd.responsibilities.length)
      throw new ResumeError(
        "invalid_input",
        "Paste a job description containing identifiable skills or responsibilities.",
      );
    const fingerprint = hash({
      versionId: b.snapshot.id,
      jdText: r.jdText,
      facts: source.provider,
      prompt: TAILORING_PROMPT_VERSION,
      model: TAILORING_MODEL,
    });
    const stored: Stored = {
      run: tailoringRunSchema.parse({
        id: r.id,
        sourceVersion: r.expectedVersion,
        model: TAILORING_MODEL,
        promptVersion: TAILORING_PROMPT_VERSION,
        status: "queued",
        jobTitle: assessed.jd.jobTitle,
        jdText: r.jdText,
        requirements: assessed.jd.keywords,
        responsibilities: assessed.jd.responsibilities,
        createdAt: new Date(now()).toISOString(),
        expiresAt: new Date(now() + 30 * 60_000).toISOString(),
        batchesDone: 0,
        batchesTotal: 2,
        before: assessed.analysis,
        after: null,
        changes: [],
        copyId: null,
        error: null,
      }),
      context: contextSchema.parse(context),
      versionId: b.snapshot.id,
      fingerprint,
      copyId: randomUUID(),
      selectionHash: null,
      lease: null,
      leaseUntil: 0,
      attempts: 0,
      draft: null,
      review: null,
    };
    try {
      return await withPersonalAuditTransaction(
        db,
        context.actor.userId,
        audit(context, "resume.updated", id, {
          reasonCode: "tailoring_requested",
          baseVersionId: b.snapshot.id,
        }),
        async (tx) => {
          // Per-owner admission and per-resume mutation locks use a consistent order.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${context.actor.userId}))`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
          assertActor(context);
          const current = await tx.resume.findFirst({
            where: where(context, id),
          });
          if (!current || current.currentVersion !== r.expectedVersion)
            throw new ResumeError("revision_conflict");
          const h = history(current.atsBreakdown),
            existing = h.runs.find((v) => v.run.id === r.id);
          if (existing) {
            if (existing.fingerprint !== fingerprint)
              throw new ResumeError(
                "revision_conflict",
                "Request ID already used for different inputs.",
              );
            throw new Replay();
          }
          const active = await tx.resume.count({
            where: {
              ownerUserId: context.actor.userId,
              status: { not: "deleted" },
              atsBreakdown: { path: ["tailoring", "active"], equals: true },
            },
          });
          if (h.runs.some(pending) || active >= 2)
            throw new ResumeError(
              "invalid_input",
              "Finish or cancel the current tailoring run first. At most two resumes can be queued.",
            );
          if (h.runs.length >= 20)
            throw new ResumeError(
              "invalid_input",
              "This resume has reached its 20-run history limit. Use a new saved copy.",
            );
          h.runs.push(stored);
          h.active = true;
          await tx.resume.update({
            where: { id },
            data: {
              atsBreakdown: metadata({
                ...root(current.atsBreakdown),
                tailoring: h,
              }),
            },
          });
          return state(current.currentVersion, h);
        },
      );
    } catch (e) {
      if (e instanceof Replay) {
        const current = await base(context, id);
        const h = history(current.resume.atsBreakdown);
        return {
          ...state(current.resume.currentVersion, h),
          run: h.runs.find((v) => v.run.id === r.id)?.run ?? null,
        };
      }
      throw e;
    }
  }
  async function cancelTailoring(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ) {
    const r = tailoringCancelSchema.parse(input);
    await authorize(context, "resume.generate");
    await base(context, id);
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      audit(context, "resume.updated", id, {
        reasonCode: "tailoring_cancelled",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        assertActor(context);
        const current = await tx.resume.findFirst({
          where: where(context, id),
        });
        if (!current) throw new ResumeError("not_found");
        const h = history(current.atsBreakdown),
          stored = h.runs.find((v) => v.run.id === r.runId);
        if (!stored) throw new ResumeError("not_found");
        if (["queued", "drafting", "ready"].includes(stored.run.status)) {
          stored.run.status = "cancelled";
          stored.lease = null;
          stored.leaseUntil = 0;
          stored.draft = null;
          stored.review = null;
        }
        h.active = h.runs.some(pending);
        await tx.resume.update({
          where: { id },
          data: {
            atsBreakdown: metadata({
              ...root(current.atsBreakdown),
              tailoring: h,
            }),
          },
        });
        return state(current.currentVersion, h);
      },
    );
  }

  // A lease owns exactly one provider batch. Process restarts can reclaim abandoned work, at most three attempts per batch.
  async function processTailoringJobs() {
    const candidates = await db.resume.findMany({
      where: {
        status: { not: "deleted" },
        atsBreakdown: { path: ["tailoring", "active"], equals: true },
      },
      take: 10,
      orderBy: { updatedAt: "asc" },
    });
    for (const candidate of candidates) {
      let claimed: Stored | null = null;
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${candidate.id}))`;
        const current = await tx.resume.findUnique({
          where: { id: candidate.id },
        });
        if (!current || current.status === "deleted") return;
        const h = history(current.atsBreakdown),
          stored = h.runs.find((v) => pending(v) && v.leaseUntil < now());
        if (!stored) return;
        stored.lease = randomUUID();
        stored.leaseUntil =
          now() + (stored.run.promptVersion === "tailor-v2" ? 180_000 : 60_000);
        stored.attempts++;
        stored.run.status = "drafting";
        claimed = storedSchema.parse(stored);
        await tx.resume.update({
          where: { id: candidate.id },
          data: {
            atsBreakdown: metadata({
              ...root(current.atsBreakdown),
              tailoring: h,
            }),
          },
        });
      });
      const stored = claimed as Stored | null;
      if (!stored) continue;
      let changes = stored.run.changes,
        after = stored.run.after,
        error: string | null = null,
        done = false;
      let draft = stored.draft,
        quality = stored.run.quality,
        warnings = stored.run.warnings,
        review = stored.review,
        total = stored.run.batchesTotal;
      try {
        if (stored.attempts > 3 || now() > Date.parse(stored.run.expiresAt))
          throw new ResumeError(
            "revision_conflict",
            "Tailoring expired. Start a new request.",
          );
        await authorize(stored.context, "resume.generate");
        await authorize(stored.context, "resume.create");
        const b = await base(
          stored.context,
          candidate.id,
          stored.run.sourceVersion,
        );
        if (b.snapshot.id !== stored.versionId)
          throw new ResumeError("revision_conflict");
        if (stored.run.promptVersion === "tailor-v2") {
          const source = fullTailoringSource(b.doc),
            jd = localAssessment(b.doc, stored.run.jdText, now()).jd;
          if (stored.run.batchesDone === 0) {
            draft = await providers.tailor(source.provider, {
              title: jd.jobTitle,
              terms: jd.keywords.map((k) => k.name),
              responsibilities: jd.responsibilities,
            });
            // Validate complete coverage now; untrusted draft stays private until the independent review finishes.
            inspectFullDraft(b.doc, draft);
          } else if (stored.run.batchesDone === 2) {
            if (!draft || !review) throw new ResumeError("invalid_input");
            const ids = review.checks
              .filter((c) => !c.supported || !c.complete)
              .map((c) => c.field);
            const revised = await providers.tailor(
              {
                ...source.provider,
                fields: source.provider.fields.filter((f) =>
                  ids.includes(f.field),
                ),
              },
              {
                title: jd.jobTitle,
                terms: jd.keywords.map((k) => k.name),
                responsibilities: jd.responsibilities,
              },
              {
                previous: {
                  changes: draft.changes.filter((c) => ids.includes(c.field)),
                },
                review: {
                  checks: review.checks.filter((c) => ids.includes(c.field)),
                },
              },
            );
            if (
              revised.changes.length !== ids.length ||
              new Set(revised.changes.map((c) => c.field)).size !==
                ids.length ||
              revised.changes.some((c) => !ids.includes(c.field))
            )
              throw new ResumeError(
                "invalid_input",
                "AI revision did not cover the rejected fields. Retry tailoring.",
              );
            draft = {
              changes: draft.changes.map(
                (c) => revised.changes.find((v) => v.field === c.field) ?? c,
              ),
            };
            inspectFullDraft(b.doc, draft);
          } else {
            if (!draft)
              throw new ResumeError(
                "invalid_input",
                "The draft was lost. Start a fresh request.",
              );
            const inspected = inspectFullDraft(b.doc, draft);
            const verdict = await providers.verifyTailoring(source.provider, {
              changes: inspected.changes,
            });
            // One bounded repair pass. Preserve originals after a second failed review.
            verifiedFullChanges(b.doc, stored.run.jdText, draft, verdict);
            review = {
              checks: verdict.checks.map((c) =>
                inspected.rejected.includes(c.field)
                  ? { ...c, supported: false }
                  : c,
              ),
            };
            if (
              stored.run.batchesDone === 1 &&
              review.checks.some((c) => !c.supported || !c.complete)
            ) {
              total = 4;
            } else {
              const result = verifiedFullChanges(
                b.doc,
                stored.run.jdText,
                draft,
                verdict,
              );
              changes = result.changes;
              quality = result.quality;
              warnings = result.warnings;
              draft = null;
              review = null;
              done = true;
            }
          }
          await authorize(stored.context, "resume.generate");
        } else {
          const batches = fieldBatches(tailoringFields(b.doc)),
            batch = batches[stored.run.batchesDone];
          if (!batch) throw new ResumeError("invalid_input");
          const jd = localAssessment(b.doc, stored.run.jdText, now()).jd;
          const output = await providers.rewrite(
            batch.map((f) => ({ field: f.id, original: f.original })),
            {
              terms: jd.keywords.map((k) => k.name),
              responsibilities: jd.responsibilities,
            },
          );
          await authorize(stored.context, "resume.generate");
          changes = [...changes, ...groundedBatch(b.doc, batch, output)];
          done = stored.run.batchesDone + 1 === batches.length;
          if (done) {
            changes = completeChanges(b.doc, stored.run.jdText, changes);
          }
        }
        if (done) {
          after = localAssessment(
            applyTailoringPreview(
              b.doc,
              changes,
              changes.map((c) => c.id),
            ),
            stored.run.jdText,
            now(),
          ).analysis;
        }
      } catch (e) {
        error =
          e instanceof AiUnavailable
            ? e.message
            : e instanceof ResumeError && e.code === "invalid_input"
              ? e.message
              : "Tailoring could not finish. The source may have changed or access expired. Reopen it and retry.";
      }
      // Do not use an expired actor to authorize new effects. Ownership is rechecked by the audit transaction; terminal cleanup only stores a sanitized error.
      await withPersonalAuditTransaction(
        db,
        stored.context.actor.userId,
        audit(stored.context, "resume.updated", candidate.id, {
          reasonCode: error
            ? "tailoring_failed"
            : done
              ? "tailoring_ready"
              : "tailoring_progress",
        }),
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${candidate.id}))`;
          const current = await tx.resume.findFirst({
            where: where(stored.context, candidate.id),
          });
          if (!current) throw new Replay();
          const h = history(current.atsBreakdown),
            run = h.runs.find((v) => v.run.id === stored.run.id);
          if (!run || !pending(run) || run.lease !== stored.lease)
            throw new Replay();
          if (current.currentVersion !== stored.run.sourceVersion)
            error =
              "Source resume changed. Save or reopen it and start a new request.";
          if (error) {
            run.run.status = "failed";
            run.run.error = error;
            run.run.changes = [];
            run.draft = null;
            run.review = null;
          } else {
            run.run.changes = changes;
            run.run.after = after;
            run.run.quality = quality;
            run.run.warnings = warnings;
            run.draft = draft;
            run.review = review;
            run.run.batchesTotal = total;
            run.run.batchesDone++;
            run.run.status = done ? "ready" : "queued";
            run.attempts = 0;
          }
          run.lease = null;
          run.leaseUntil = 0;
          h.active = h.runs.some(pending);
          await tx.resume.update({
            where: { id: current.id },
            data: {
              atsBreakdown: metadata({
                ...root(current.atsBreakdown),
                tailoring: h,
              }),
            },
          });
        },
      ).catch((e: unknown) => {
        if (!(e instanceof Replay)) throw e;
      });
      // Bound external work to one batch per tick; other requests retain provider capacity.
      return;
    }
  }

  async function applyTailoring(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ) {
    const r = tailoringApplySchema.parse(input);
    await authorize(context, "resume.create");
    await authorize(context, "resume.generate");
    const b = await base(context, id);
    const saved = history(b.resume.atsBreakdown).runs.find(
      (v) => v.run.id === r.runId,
    );
    if (!saved) throw new ResumeError("not_found");
    const selected = [...r.selectedIds].sort(),
      selectionHash = hash({
        selected,
        title: r.title,
        version: r.expectedVersion,
      });
    try {
      await withPersonalAuditTransaction(
        db,
        context.actor.userId,
        audit(context, "resume.created", saved.copyId, {
          reasonCode: "tailored_copy",
          baseVersionId: saved.versionId,
        }),
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
          assertActor(context);
          const current = await tx.resume.findFirst({
            where: where(context, id),
          });
          if (!current) throw new ResumeError("not_found");
          const h = history(current.atsBreakdown),
            stored = h.runs.find((v) => v.run.id === r.runId);
          if (!stored) throw new ResumeError("not_found");
          if (stored.run.status === "saved") {
            if (stored.selectionHash !== selectionHash)
              throw new ResumeError(
                "revision_conflict",
                "This proposal was saved with different choices.",
              );
            throw new Replay();
          }
          if (
            stored.run.status !== "ready" ||
            current.currentVersion !== r.expectedVersion ||
            stored.run.sourceVersion !== r.expectedVersion ||
            now() > Date.parse(stored.run.expiresAt)
          )
            throw new ResumeError(
              "revision_conflict",
              "Suggestions are outdated or incomplete. Request fresh suggestions.",
            );
          const snapshot = await tx.resumeVersion.findUnique({
            where: { id: stored.versionId },
          });
          if (
            !snapshot ||
            snapshot.resumeId !== id ||
            snapshot.versionNumber !== r.expectedVersion
          )
            throw new ResumeError("revision_conflict");
          const content = root(snapshot.content),
            doc = editorDocumentSchema.parse(content.editorDraft);
          if (
            new Set(r.selectedIds).size !== r.selectedIds.length ||
            r.selectedIds.some(
              (id) => !stored.run.changes.some((c) => c.id === id),
            )
          )
            throw new ResumeError(
              "invalid_input",
              "Select only known proposals, once each.",
            );
          const next = applyTailoringPreview(
            doc,
            stored.run.changes,
            r.selectedIds,
          );
          next.title = r.title;
          const versionId = randomUUID(),
            assessed = localAssessment(next, stored.run.jdText, now());
          const nextContent = metadata({
            ...content,
            title: r.title,
            editorDraft: next,
            sections: next.sections.map((s) => ({
              ...s,
              summary: plain(s.summary),
              entries: s.entries.map((e) => ({
                ...e,
                description: plain(e.description),
              })),
            })),
          });
          const scoreMetadata = metadata({
            tailoringOrigin: {
              sourceResumeId: id,
              sourceVersionId: stored.versionId,
              runId: r.runId,
              model: stored.run.model,
              promptVersion: stored.run.promptVersion,
              selectedIds: selected,
            },
            jdMatching: {
              dismissed: [],
              evaluations: [
                jdEvaluationSchema.parse({
                  ...assessed.evaluation,
                  id: randomUUID(),
                  resumeId: stored.copyId,
                  resumeVersion: 1,
                  versionId,
                  inputHash: hash(readinessProjection(next)),
                  jdHash: hash(stored.run.jdText),
                  jdText: stored.run.jdText,
                  evaluatedAt: new Date(now()).toISOString(),
                  analysis: "local",
                  model: null,
                }),
              ],
            },
            readiness: {
              evaluations: [
                readinessEvaluationSchema.parse({
                  ...computeReadiness(readinessProjection(next)),
                  id: randomUUID(),
                  resumeId: stored.copyId,
                  resumeVersion: 1,
                  versionId,
                  inputHash: hash(readinessProjection(next)),
                  evaluatedAt: new Date(now()).toISOString(),
                }),
              ],
              dismissed: [],
            },
          });
          await tx.resume.create({
            data: {
              id: stored.copyId,
              profileId: current.profileId,
              workspaceType: "individual",
              workspaceId: context.actor.personalWorkspaceId,
              ownerUserId: context.actor.userId,
              createdByUserId: context.actor.userId,
              templateId: current.templateId,
              content: nextContent,
              atsBreakdown: scoreMetadata,
              currentVersion: 1,
              status: "draft",
            },
          });
          await tx.resumeVersion.create({
            data: {
              id: versionId,
              resumeId: stored.copyId,
              versionNumber: 1,
              createdByUserId: context.actor.userId,
              content: nextContent as Parameters<
                Database["resumeVersion"]["create"]
              >[0]["data"]["content"],
              atsBreakdown: scoreMetadata,
            },
          });
          stored.run.status = "saved";
          stored.run.copyId = stored.copyId;
          stored.selectionHash = selectionHash;
          await tx.resume.update({
            where: { id },
            data: {
              atsBreakdown: metadata({
                ...root(current.atsBreakdown),
                tailoring: h,
              }),
            },
          });
        },
      );
    } catch (e) {
      if (!(e instanceof Replay)) throw e;
    }
    return options.getResume(context, saved.copyId);
  }
  return {
    getTailoring,
    startTailoring,
    cancelTailoring,
    applyTailoring,
    processTailoringJobs,
  };
}
