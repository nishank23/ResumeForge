# Architecture

## Implemented stack

Four React/Vite microfrontends (shell, auth, profile, resume) use federation and browser-safe shared controls. The shell owns routing, session lifecycle, theme and page errors. Hono gateway/auth/profile/resume services use strict TypeScript, Zod and Prisma/PostgreSQL. Resume-core owns pure scoring/domain types without authentication, storage or HTTP.

Paid Gemini REST adapters provide semantic JD evidence, selected-description rewriting and 768-dimensional retrieval. Queries restrict owner, workspace, resume and exact version. Existing single-target/vector work is synchronous. Full tailoring uses Gemini 3.8 Flash whole-source writing and separate fact/coverage review, with one bounded correction pass. It uses an owned persisted queue in Resume.atsBreakdown with leases, cancellation, restart recovery and independent-copy save. [Tailoring contract](../docs/full-resume-tailoring.md). OpenCode and Textkernel are not active dependencies.

Local Compose packages built MFEs, personal services and audit recipient/worker with PostgreSQL 18/pgvector and retained generated-credential volumes. Gateway/auth ports are 4000/4001; profile/resume are 4002/4003 internally. MFEs use 3000–3003. The audit-only listener uses 4005 and does not activate shared business routes. [Setup](../README.md) and [Docker contract](../docs/docker-setup.md) are authoritative for local operation.

## Ownership and invariants

- Auth owns identity/sessions; profile-service owns master professional/contact writes; resume-service owns documents, versions, assessments and proposals.
- Reuse authorized use cases at HTTP, future worker and integration boundaries. Recheck owner/action/resource scope inside use cases and at serialization/export.
- Private contact snapshots may exist in owner resumes. Exclude them, source files and OAuth credentials from scoring/AI/retrieval projections. Shared access stays gated until role/consent/output/audit defects are repaired.
- Preserve stable editor targets, expected-version saves, atomic version/audit writes, server-stored proposals and idempotent Apply.
- Browser and PDF renderers are separate. Printable pages never use decorative app effects.

## Proposed expansion

[PLAN.md](../PLAN.md)'s first tailoring slice reuses the resume MFE/service and provider seam. The metadata queue preserves existing restricted grants. Dedicated task-table orchestration, usage ledgers and optional profile snapshots remain follow-on work. No new ai-copilot-service or provider SDK is approved merely by the blueprint.

TaskRun/JDHistory/version changes, structured fact provenance, personal JobApplication, Subscription/UsageLedger and CoverLetter contracts require phase-specific design and approval. New models are not migrated or connected yet. Production hosting, durable artifacts, distributed sessions, backups and retention are release work; local Docker success does not complete them.
