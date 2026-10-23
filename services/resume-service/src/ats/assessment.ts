import { createHash, createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { z } from "zod";
import {
  ATS_RUBRIC,
  atsAssessmentInputSchema,
  atsAssessmentSchema,
  editorDocumentSchema,
  type AtsAssessment,
  type AtsAssessmentInput,
  type EditorDocument,
} from "@resume-forge/shared-types";
import { readinessProjection } from "@resume-forge/resume-core";
import {
  withPersonalAuditTransaction,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import type { AuditEventIntent } from "@resume-forge/audit-contracts";
import type { ResumeServiceContext } from "../resume.js";
import { ResumeError } from "../contracts.js";
import { AiUnavailable, GEMINI_MODEL } from "./ai.js";
import { assertContactFree } from "./rewrite.js";

type Database = ReturnType<typeof createDatabaseClient>;
type Json = Parameters<Database["resume"]["update"]>[0]["data"]["atsBreakdown"];
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const evaluationSchema = z
  .object({
    id: z.string().uuid(),
    resumeId: z.string().uuid(),
    versionId: z.string().uuid(),
    resumeVersion: z.number().int().positive(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    jdHash: z.string().regex(/^[a-f0-9]{64}$/),
    evaluatedAt: z.string().datetime(),
    assessment: atsAssessmentSchema,
  })
  .strict();
const historySchema = z.array(evaluationSchema).max(100);
export interface AtsClient {
  model: string;
  assess(input: AtsAssessmentInput): Promise<AtsAssessment>;
}

/** The service is private loopback; credentials never reach the browser or gateway. */
export function createAtsClient(
  authKey: string,
  transport: typeof fetch = fetch,
): AtsClient {
  const env: Record<string, string | undefined> = {};
  const root = process.env.RESUME_FORGE_LOCAL_ROOT ?? process.cwd();
  for (const name of [
    ".env",
    ".local/ai-provider.env",
    ".local/auth-transport.env",
  ]) {
    const path = resolve(root, name);
    if (existsSync(path))
      Object.assign(env, parseEnv(readFileSync(path, "utf8")));
  }
  Object.assign(env, process.env);
  const key =
    env.ATS_SERVICE_KEY?.trim() ||
    createHmac("sha256", authKey).update("ats-service-v1").digest("hex");
  const port = Number(env.ATS_SERVICE_PORT || 4004);
  if (
    authKey.length < 32 ||
    key.length < 32 ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new Error("Internal ATS configuration is unavailable.");
  return {
    model: GEMINI_MODEL,
    async assess(input) {
      try {
        const response = await transport(
          `http://127.0.0.1:${String(port)}/internal/ats/assess`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(atsAssessmentInputSchema.parse(input)),
            redirect: "error",
            signal: AbortSignal.timeout(60_000),
          },
        );
        if (!response.ok || !response.body) throw new AiUnavailable();
        const reader =
          response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const item = await reader.read();
            if (item.done) break;
            size += item.value.byteLength;
            if (size > 262144) throw new AiUnavailable();
            chunks.push(item.value);
          }
        } finally {
          await reader.cancel().catch(() => undefined);
        }
        const result = atsAssessmentSchema.parse(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        if (result.model !== GEMINI_MODEL) throw new AiUnavailable();
        return result;
      } catch {
        throw new AiUnavailable(
          "Job fit is unavailable or busy. Retry shortly; your resume is unchanged.",
        );
      }
    },
  };
}

/** Visible professional facts only. No header, contacts, source files, layout or hidden items. */
export function atsSources(doc: EditorDocument): AtsAssessmentInput["sources"] {
  const projection = readinessProjection(doc);
  const sources: AtsAssessmentInput["sources"] = [];
  for (const section of projection.sections) {
    const kind = [
      "summary",
      "experience",
      "projects",
      "education",
      "skills",
      "certifications",
      "languages",
    ].includes(section.kind)
      ? (section.kind as AtsAssessmentInput["sources"][number]["kind"])
      : "other";
    const add = (id: string, pieces: string[]) => {
      const text = pieces
        .map((part) => part.trim())
        .filter(Boolean)
        .join("\n");
      if (text)
        sources.push({
          id: id.length > 120 ? `source:${hash(id)}` : id,
          kind,
          text,
        });
    };
    add(`${section.id}:summary`, section.summary);
    for (const entry of section.entries) {
      const d = entry.dates;
      const dates = [
        d.startYear && `${d.startYear}-${d.startMonth || "?"}`,
        d.current
          ? "present"
          : d.endYear && `${d.endYear}-${d.endMonth || "?"}`,
      ]
        .filter(Boolean)
        .join(" to ");
      add(`${section.id}:${entry.id}`, [
        entry.title,
        entry.subtitle,
        ...(doc.sections
          .find((s) => s.id === section.id)
          ?.entries.filter((e) => e.id === entry.id)
          .flatMap((e) => [e.fieldOfStudy, e.grade, e.employmentType]) ?? []),
        dates,
        entry.technologies ?? "",
        ...entry.details,
      ]);
    }
    section.groups.forEach((group, index) => {
      add(`${section.id}:group:${String(index)}`, [
        group.label,
        ...group.items,
      ]);
    });
    const original = doc.sections.find((item) => item.id === section.id);
    const languages =
      original?.languages
        .filter((item) => !item.hidden)
        .map((item) => `${item.text} ${item.proficiency}`) ?? [];
    add(`${section.id}:languages`, languages);
  }
  assertContactFree(sources.map((source) => source.text).join("\n"), doc);
  const identity = `${doc.header.firstName} ${doc.header.lastName}`
    .trim()
    .toLowerCase();
  if (
    identity.length >= 5 &&
    sources.some((source) => source.text.toLowerCase().includes(identity))
  )
    throw new ResumeError(
      "invalid_input",
      "Remove personal identity from professional descriptions before checking job fit.",
    );
  return sources;
}

export function createAssessmentUseCases(options: {
  db: Database;
  now: () => number;
  authorize: (
    context: ResumeServiceContext,
    permission: "resume.read" | "ats.run" | "ats.view",
  ) => Promise<unknown>;
  assert: (context: ResumeServiceContext) => void;
  audit: (
    context: ResumeServiceContext,
    action: AuditEventIntent["action"],
    id: string,
    metadata?: AuditEventIntent["metadata"],
  ) => AuditEventIntent;
  client?: AtsClient;
}) {
  const { db, now, authorize, audit, client, assert: assertActor } = options;
  const where = (context: ResumeServiceContext, id: string) => ({
    id,
    ownerUserId: context.actor.userId,
    workspaceId: context.actor.personalWorkspaceId,
    status: { not: "deleted" },
  });
  const root = (value: unknown) =>
    value == null ? {} : z.record(z.unknown()).parse(value);
  const history = (value: unknown) =>
    historySchema.parse(root(value).atsAssessments ?? []);
  const state = (version: number, value: unknown) => ({
    currentVersion: version,
    evaluation:
      [...history(value)]
        .reverse()
        .find(
          (entry) =>
            entry.resumeVersion === version &&
            entry.assessment.model === (client?.model ?? GEMINI_MODEL),
        ) ?? null,
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
        "Save or reopen the latest resume before checking job fit.",
      );
    assertActor(context);
    return resume;
  }
  async function getAtsAssessment(context: ResumeServiceContext, id: string) {
    await authorize(context, "ats.view");
    const resume = await base(context, id);
    return state(resume.currentVersion, resume.atsBreakdown);
  }
  async function runAtsAssessment(
    context: ResumeServiceContext,
    id: string,
    input: unknown,
  ) {
    const request = z
      .object({
        expectedVersion: z.number().int().positive(),
        jdText: z.string().trim().min(50).max(12000),
        consent: z.literal(true),
      })
      .strict()
      .safeParse(input);
    if (!request.success)
      throw new ResumeError(
        "invalid_input",
        "Paste a JD between 50 and 12,000 characters and confirm the Gemini assessment.",
      );
    await authorize(context, "ats.run");
    const resume = await base(context, id, request.data.expectedVersion);
    if (!client)
      throw new AiUnavailable("Job fit service is unavailable. Retry shortly.");
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
    const doc = editorDocumentSchema.parse(root(snapshot.content).editorDraft);
    assertContactFree(request.data.jdText, doc);
    const payload = atsAssessmentInputSchema.safeParse({
      jdText: request.data.jdText,
      sources: atsSources(doc),
    });
    if (!payload.success)
      throw new ResumeError(
        "invalid_input",
        "Resume exceeds the bounded assessment size. Shorten visible professional content before retrying.",
      );
    const inputHash = hash({
        rubric: ATS_RUBRIC,
        sources: payload.data.sources,
      }),
      jdHash = hash(payload.data.jdText);
    const cached = [...history(resume.atsBreakdown)]
      .reverse()
      .find(
        (entry) =>
          entry.versionId === snapshot.id &&
          entry.inputHash === inputHash &&
          entry.jdHash === jdHash &&
          entry.assessment.model === client.model,
      );
    if (cached)
      return { currentVersion: resume.currentVersion, evaluation: cached };
    await authorize(context, "ats.run");
    assertActor(context);
    const checked = atsAssessmentSchema.safeParse(
      await client.assess(payload.data),
    );
    if (!checked.success)
      throw new AiUnavailable("Job fit response could not be verified. Retry.");
    const assessment = checked.data;
    if (
      assessment.model !== client.model ||
      assessment.requirements.length === 0
    )
      throw new AiUnavailable();
    // Revalidate the internal response against this exact owned source snapshot.
    for (const requirement of assessment.requirements) {
      if (
        !payload.data.jdText.includes(requirement.jdQuote) ||
        requirement.evidence.some(
          (evidence) =>
            !payload.data.sources.some(
              (source) =>
                source.id === evidence.sourceId &&
                source.text.includes(evidence.quote),
            ),
        )
      )
        throw new AiUnavailable();
    }
    await authorize(context, "ats.run");
    assertActor(context);
    const evaluation = evaluationSchema.parse({
      id: randomUUID(),
      resumeId: id,
      versionId: snapshot.id,
      resumeVersion: resume.currentVersion,
      inputHash,
      jdHash,
      evaluatedAt: new Date(now()).toISOString(),
      assessment,
    });
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      audit(context, "resume.updated", id, {
        status: "succeeded",
        reasonCode: "ats_evidence_evaluated",
      }),
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        assertActor(context);
        const current = await tx.resume.findFirst({
          where: where(context, id),
        });
        if (!current) throw new ResumeError("not_found");
        if (current.currentVersion !== request.data.expectedVersion)
          throw new ResumeError(
            "revision_conflict",
            "Resume changed during assessment. Save and check again.",
          );
        const rows = history(current.atsBreakdown);
        const replay = [...rows]
          .reverse()
          .find(
            (entry) =>
              entry.versionId === snapshot.id &&
              entry.inputHash === inputHash &&
              entry.jdHash === jdHash &&
              entry.assessment.model === client.model,
          );
        if (replay)
          return { currentVersion: current.currentVersion, evaluation: replay };
        if (rows.length >= 100)
          throw new ResumeError(
            "invalid_input",
            "Retained assessment limit reached.",
          );
        const meta = {
          ...root(current.atsBreakdown),
          atsAssessments: [...rows, evaluation],
        };
        const serialized = JSON.stringify(meta);
        if (Buffer.byteLength(serialized) > 2_000_000)
          throw new ResumeError(
            "invalid_input",
            "Retained ATS metadata limit reached.",
          );
        await tx.resume.update({
          where: { id },
          data: { atsBreakdown: JSON.parse(serialized) as Json },
        });
        return { currentVersion: current.currentVersion, evaluation };
      },
    );
  }
  return { getAtsAssessment, runAtsAssessment };
}
