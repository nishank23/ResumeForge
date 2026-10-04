# F03 — Database Schema and Prisma

**Phase:** 1 — Foundation · **Priority:** Critical · **Implementation:** In progress — initial local identity migration verified

## Goal and dependencies

Create the persistence foundation for all phases without losing tenant isolation or profile/contact separation. Read [data-model.md](../data-model.md). Resolve D03/D04/D08/D11 before dependent schema migrations and D07 before vector migrations. UI work can proceed independently after authorization.

## Ownership and planned files

`packages/prisma-client/prisma/schema.prisma`, model files for user/profile/resume/workspace/audit, migrations, `src/index.ts`, `src/vectors.ts`, and shared domain schemas. Service ownership remains logical even when one database/client package is shared.

## Build scope

1. Validate the planned Prisma 7 + local PostgreSQL runtime/adapter/version combination using current official documentation and a development database. Hosting is deferred; the local pgvector extension is independently ready, while real vector columns/models/indexes remain gated by D07.
2. Translate the approved logical model into foreign keys, typed roles/statuses, unique membership/provider/version identities, and scoped indexes.
3. Keep UserContact separate, add the approved session/workspace/profile-access model, and define version/task/audit foundations before storing private data.
4. Version JSONB schemas and embedding metadata. Add vector columns/indexes only after dimension/model compatibility is verified.
5. Write reviewed migrations and synthetic seed fixtures for two users and multiple isolated workspaces. Real contact/resume data is not fixture material.
6. Plan backup/restore and safe migration recovery. Runtime services receive only the database privileges needed for their responsibilities.

## Integrity behavior

Protect resume-version allocation and current-version updates against concurrency. Enforce one personal workspace per user, unique active membership identity, and parent-scoped section access. Document any invariants requiring application checks rather than database constraints. Agree on deletion/retention behavior before cascading data.

## Acceptance and verification

- [ ] Fresh database migration and client generation succeed with the pinned toolchain.
- [ ] Constraints reject duplicate provider identities/memberships/version numbers and invalid parent references.
- [ ] Scoped fixture queries cannot cross workspace/profile boundaries.
- [ ] Parameterized vector operations reject wrong dimensions/model spaces and return scoped data.
- [ ] Profile/contact separation and approved grant/copy semantics are reflected in both models and DTOs.
- [ ] Migration review and development restore/recovery evidence are recorded.

This feature establishes future entities/contracts; it does not activate organization/vendor UI or mark later product features implemented.

## Builder and suggestion foundations — 2026-09-29 planning update

Review the proposed ResumeSuggestion/base-version/target relation, stable section/item IDs and suggestion TaskRun kind before F06. Basic builder mode permits absent JD and ATS data. Record provenance and idempotent applied-version linkage; no generated proposal directly updates the current resume or master profile.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Schema/transaction checks cover stable targets, nullable JD, one version per Apply identity, stale revisions and scoped proposal relations.

## U06 schema planning boundary

The [data model](../data-model.md) adds proposed resume metadata/preferences, issue preferences and later F19 import/F20 render-settings/preset relations. Define stable version/provenance and ownership seams early, but introduce later-phase persistence only with its approved implementation slice; context approval alone never executes migrations.

## Phase 1 local runtime roles — 2026-10-02

- [x] Distinct restricted auth, profile producer, audit relay and ledger ingestor connections enforce a versioned table/column grant allowlist. No runtime role owns objects, inherits memberships, has administrative/DDL privileges or can change existing AuditEvent history.
- [x] Runtime entry points reject incorrect identities or missing/extra effective privileges; root/process database overrides cannot select administrative credentials.
- [x] Verify scoped capture, duplicate rollback, real authenticated HTTP delivery, denied cross-service/DDL operations, future-object denial, column-grant drift and transactional/idempotent provisioning in disposable local PostgreSQL databases.

Run `pnpm db:runtime:init` after local migrations and restart services. Profile capture uses INSERT-only outbox access; auth reads only onboarding columns from UserProfile. Professional-profile GET/PUT now have per-user policy and scoped queries; contacts/sections, shared policy, hosted provisioning and retention remain pending. The service grants are not row-level security or complete F03 acceptance. See [role setup and verification](../../docs/runtime-database-roles.md).

## Private professional persistence — 2026-10-03

- [x] Existing master-profile read/update uses verified actors and owned personal scope; shared role bundles remain inactive.
- [x] Strict professional DTOs and write schemas exclude contacts, onboarding state, identities, embeddings and ownership fields. Concurrent writes use expected revision with one winner.
- [x] Restricted profile queries, success capture and owned-workspace denial capture/delivery pass disposable database HTTP tests, including outbox COMMIT failure withholding reads and rolling back writes.

Run `pnpm db:test:profile`: 13 passes. Creation/onboarding drafts, section/contact APIs and full F03 acceptance remain pending. See [API contract and checks](../../docs/profile-api.md).
