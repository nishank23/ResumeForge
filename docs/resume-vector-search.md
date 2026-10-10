# Private resume vector retrieval — 2026-10-09

## Implemented scope

The personal editor's optional Gemini JD analysis now uses PostgreSQL/pgvector retrieval over the current saved resume. This is a bounded resume-specific retrieval step, not candidate ranking, a hiring pipeline, cross-user search or full production RAG. Local JD scoring and general readiness require no vectors or external provider.

The user requested vector search and approved paid Gemini processing of professional resume content. D07 is resolved for this slice: `gemini-embedding-001`, 768 dimensions, `professional-v1` projection. [Google documents](https://ai.google.dev/gemini-api/docs/embeddings) task-specific document/query embeddings and selectable output dimensions. Every response must contain exactly 768 finite values with nonzero norm; vectors are normalized before insertion. No padding or truncation is used. Proposed profile/JD 1536 and Skill 384 spaces remain unimplemented and cannot be compared with this space.

Visible experience/project descriptions, achievements and technology labels become at most 40 entry chunks, each at most 6,000 characters. Headers, contacts, hidden entries, appearance and original extraction text are excluded. Contact-like content in professional fields or the JD blocks external processing. Up to 30 parsed responsibilities supply query embeddings. The batch adapter permits at most 70 document/query inputs, two active requests, an eight-second deadline and a 2 MB response bound. Semantic analysis remains optional and needs explicit consent; the consent text discloses private embedding storage.

## Storage, access and lifecycle

`ResumeSearchChunk` is a derived private cache linked to an immutable ResumeVersion. Rows include owner/workspace/resume/version, stable section/item IDs, model, dimensions, projection version, SHA-256 source hash, professional text, `vector(768)` and generation time. There is no training dataset, model fine-tuning or upload of this database to a model provider. Paid-service data handling follows [Gemini terms](https://ai.google.dev/gemini-api/terms); the service's paid flag does not independently prove billing status.

The migration adds exact-space/size/hash checks, a unique entry/model/projection index, scoped B-tree index, HNSW cosine index and row-level security. Runtime SELECT/INSERT require transaction-local actor/workspace and a matching owned, current, nondeleted Resume/ResumeVersion parent. DELETE is restricted to the actor/workspace's cache. Authentication, membership/action policy and explicit owner/version predicates remain application requirements. RLS settings are service-controlled, not protection against a compromised service setting another actor ID. The database owner can bypass RLS.

Only the resume runtime receives SELECT/INSERT/DELETE on this cache and five explicitly listed pgvector conversion/distance functions. It receives no source-table DELETE or cache UPDATE, DDL, trigger-function EXECUTE or protected-contact access. A narrowly scoped owner trigger deletes cache rows atomically when the saved version changes or the resume is soft-deleted. Source versions and audit history remain intact. Restore requires another consented semantic analysis to rebuild embeddings.

Before provider egress, the service authorizes the saved version and captures sanitized audit. After embedding, it reauthorizes, locks the resume and rechecks the version before inserting cache/audit atomically. Late responses cannot publish stale chunks. Identical current version/JD/method assessments replay without a provider call. A new JD can reuse unchanged entry embeddings; query embeddings are transient. All source edits invalidate the version cache, including unchanged entries in the new version. Durable indexing/backfill is not built.

## Retrieval and score boundary

A parameterized materialized query filters owner/workspace/resume/current version/model/projection **before** exact cosine ranking. It selects three candidates per responsibility and returns only validated stable entry IDs and bounded similarity values. This bounded query deliberately does not use the HNSW index: exact ranking over at most 40 chunks avoids filtered approximate-search recall starvation. The HNSW index provides infrastructure for a later authorized larger corpus; current throughput and large-corpus scaling are not benchmarked.

Gemini checks correspondence only among retrieved candidates. Every returned quote must match a visible saved detail and its exact entry/requirement, and that entry must be a retrieved candidate for that requirement. Similarity alone never adds score points. The approved deterministic 30/25/20/15/10 rubric owns the score. Grounded quotes establish provenance, not truth or semantic correctness; finite parser coverage and corpus-quality evaluation remain limitations.

The optional `retrieval` assessment field contains model, dimensions, indexed/reused chunk counts and candidate requirement/section/item/similarity records. Older assessment responses remain valid. Old semantic results without retrieval metadata are upgraded on recheck. No separate search endpoint or browser credential is exposed.

## Local setup and rollback

The local migration and restricted runtime grants have already been applied to `127.0.0.1:55432/resume_forge_dev`. Existing role passwords and Resume/ResumeVersion row counts were preserved. Hosted deployment remains pending.

```sh
cd /Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2
RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 node scripts/migrate-local-vectors.mjs
RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 node scripts/init-runtime-db.mjs
```

The first helper validates the managed loopback administrator/database/nonproduction boundary, runs Prisma migrations and checks source row counts. The initializer preserves existing secrets and adds only the current grant matrix. Keep `GEMINI_API_KEY` in the original ignored `.env` and `GEMINI_DATA_MODE=paid` in ignored `.local/ai-provider.env`. Restart the existing runtime after configuration changes; do not launch duplicate occupied ports.

For rollback, stop resume-service, restore the preceding application/runtime grant contract and execute [resume-vector-rollback.sql](resume-vector-rollback.sql) as the managed database owner. It removes only the trigger, function and derived table; it retains source resumes, versions, contacts, audit and the shared vector extension. Reconcile Prisma migration history deliberately before reapplying; deleting an applied migration file is not a rollback. Disposable tests prove rollback and rebuild preserve complete source/contact/audit rows. No rollback was run on the user's development data.

## Manual verification

1. Open `http://localhost:3000`, sign in and upload/reopen a saved resume. Use a copy for edit tests.
2. Open **Optimize for JD**, paste the JD, enable **Add Gemini semantic analysis**, read/check consent and analyze. Expect the five fixed-rule components plus **Semantic search** counts and candidate evidence. Local mode works without external processing.
3. Reload/reopen. Resume version, JD, analysis mode and assessment remain; per-request consent resets. Repeating the same assessment replays it. A different JD can reuse current entry embeddings.
4. Click an experience/project **Fix**. Verify that entry's own description and **Improve with AI** action. Review every proposed claim before applying; never add missing qualifications to increase a score.
5. Save a manual change. The old JD assessment becomes stale, cache rows are purged and a new semantic run rebuilds only current-version evidence. Delete a disposable resume: access and its derived cache disappear. Undo restores source history; semantic cache needs rebuilding.
6. Download the saved PDF. It contains saved resume content, not scores, consent UI, embeddings or assistant controls.

Actual Chrome verification imported the supplied sample into **Data Engineer JD QA — imported copy**, preserving three experiences, two projects, education, skills and languages. The supplied Data Engineer JD returned **36/100**, with five indexed chunks and twelve evidence candidates. Resume/JD/result reload and a version-1 PDF download passed. The original saved resume was not changed. General readiness was 100/100 under basic rules; that does not establish job suitability. Missing Airflow/BigQuery/HR migration evidence was not invented. Provider rewrite verification is recorded separately in [ATS workflow](ats-workflow.md).

Pending: durable indexing/backfill, model-space migration/re-embedding budgets, hosted provisioning, production quotas/retention, authorized cross-resume retrieval, HR-domain policy, load/recall benchmarks and broader scoring quality evaluation. Vector storage alone does not resolve these.
