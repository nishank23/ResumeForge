import { createHash, randomUUID } from "node:crypto";
import type { createDatabaseClient } from "@resume-forge/prisma-client";
import { AiUnavailable } from "./ai.js";
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;
export const PROJECTION_VERSION = "professional-v1";
type Entry = { sectionId: string; itemId: string; details: string[] };
type Chunk = Entry & { text: string; sourceHash: string };
type Scope = {
  resumeId: string;
  versionId: string;
  ownerUserId: string;
  workspaceId: string;
};
type Database = ReturnType<typeof createDatabaseClient>;
type Tx = Parameters<Parameters<Database["$transaction"]>[0]>[0];
export function vectorChunks(entries: Entry[]): Chunk[] {
  const chunks = entries
    .filter((e) => e.details.some((d) => d.trim()))
    .map((e) => {
      const text = e.details.filter((d) => d.trim()).join("\n");
      if (text.length > 6000)
        throw new AiUnavailable(
          "An entry exceeds the 6,000-character embedding limit. Use local matching.",
        );
      return {
        ...e,
        text,
        sourceHash: createHash("sha256").update(text).digest("hex"),
      };
    });
  if (chunks.length > 40)
    throw new AiUnavailable(
      "This analysis supports up to 40 professional entries. Use local matching.",
    );
  return chunks;
}
export function vectorLiteral(values: number[]): string {
  if (
    values.length !== 768 ||
    values.some((v) => !Number.isFinite(v)) ||
    Math.hypot(...values) < 1e-12
  )
    throw new AiUnavailable("Invalid embedding vector.");
  return `[${values.join(",")}]`;
}
export async function setVectorScope(tx: Tx, scope: Scope) {
  await tx.$executeRaw`SELECT set_config('resume_forge.actor',${scope.ownerUserId},true),set_config('resume_forge.workspace',${scope.workspaceId},true)`;
}
export async function vectorCache(db: Database, scope: Scope, chunks: Chunk[]) {
  return db.$transaction(async (tx) => {
    await setVectorScope(tx, scope);
    const rows = await tx.$queryRaw<
      { sectionId: string; itemId: string; sourceHash: string }[]
    >`
   SELECT "sectionId","itemId","sourceHash" FROM "ResumeSearchChunk"
   WHERE "ownerUserId"=${scope.ownerUserId}::uuid AND "workspaceId"=${scope.workspaceId}::uuid
   AND "resumeId"=${scope.resumeId}::uuid AND "versionId"=${scope.versionId}::uuid
   AND model=${EMBEDDING_MODEL} AND "projectionVersion"=${PROJECTION_VERSION}`;
    return chunks.filter(
      (c) =>
        !rows.some(
          (v) =>
            v.sectionId === c.sectionId &&
            v.itemId === c.itemId &&
            v.sourceHash === c.sourceHash,
        ),
    );
  });
}
export async function saveVectorChunks(
  tx: Tx,
  scope: Scope,
  chunks: Chunk[],
  vectors: number[][],
) {
  if (chunks.length !== vectors.length)
    throw new AiUnavailable("Incomplete embedding batch.");
  await setVectorScope(tx, scope);
  // Replaced versions are private derived cache, not immutable source history.
  await tx.$executeRaw`DELETE FROM "ResumeSearchChunk" WHERE "ownerUserId"=${scope.ownerUserId}::uuid AND "workspaceId"=${scope.workspaceId}::uuid AND "resumeId"=${scope.resumeId}::uuid AND "versionId"<>${scope.versionId}::uuid`;
  for (const [i, c] of chunks.entries()) {
    const embedding = vectorLiteral(vectors[i] ?? []);
    await tx.$executeRaw`INSERT INTO "ResumeSearchChunk" (id,"versionId","resumeId","ownerUserId","workspaceId","sectionId","itemId",model,dimensions,"projectionVersion","sourceHash",text,embedding)
   VALUES (${randomUUID()}::uuid,${scope.versionId}::uuid,${scope.resumeId}::uuid,${scope.ownerUserId}::uuid,${scope.workspaceId}::uuid,${c.sectionId},${c.itemId},${EMBEDDING_MODEL},768,${PROJECTION_VERSION},${c.sourceHash},${c.text},${embedding}::vector)
   ON CONFLICT ("versionId","sectionId","itemId",model,"projectionVersion") DO NOTHING`;
  }
}
export async function retrieveVectorEvidence(
  db: Database,
  scope: Scope,
  requirements: string[],
  vectors: number[][],
  entries: Entry[],
) {
  if (requirements.length !== vectors.length)
    throw new AiUnavailable("Incomplete query embeddings.");
  return db.$transaction(async (tx) => {
    await setVectorScope(tx, scope);
    const hits: {
      requirement: string;
      sectionId: string;
      itemId: string;
      similarity: number;
    }[] = [];
    for (const [i, requirement] of requirements.entries()) {
      const embedding = vectorLiteral(vectors[i] ?? []);
      // Exact ranking after materialized authorization/version filtering prevents filtered ANN starvation.
      const rows = await tx.$queryRaw<
        { sectionId: string; itemId: string; similarity: number }[]
      >`
    WITH scoped AS MATERIALIZED (
     SELECT "sectionId","itemId",embedding FROM "ResumeSearchChunk"
     WHERE "ownerUserId"=${scope.ownerUserId}::uuid AND "workspaceId"=${scope.workspaceId}::uuid
     AND "resumeId"=${scope.resumeId}::uuid AND "versionId"=${scope.versionId}::uuid
     AND model=${EMBEDDING_MODEL} AND dimensions=768 AND "projectionVersion"=${PROJECTION_VERSION}
    ) SELECT "sectionId","itemId",1-(embedding <=> ${embedding}::vector) AS similarity
    FROM scoped ORDER BY embedding <=> ${embedding}::vector,"sectionId","itemId" LIMIT 3`;
      for (const row of rows)
        if (
          Number.isFinite(row.similarity) &&
          entries.some(
            (e) => e.sectionId === row.sectionId && e.itemId === row.itemId,
          )
        )
          hits.push({
            requirement,
            ...row,
            similarity:
              Math.round(Math.max(-1, Math.min(1, row.similarity)) * 10000) /
              10000,
          });
    }
    const selected = entries.filter((e) =>
      hits.some((h) => h.sectionId === e.sectionId && h.itemId === e.itemId),
    );
    return { hits, entries: selected };
  });
}
