# Local runtime database roles

## Implemented boundary — 2026-10-11

- [x] ✅ Five distinct restricted runtime roles, generated private credentials, transactional privilege provisioning and startup verification.
- [x] ✅ Atomic sanitized audit capture; separate outbox delivery and append-only ingestion.
- [ ] Hosted provisioning, credential rotation, supervision and retention/purge are not implemented.

The allowlist is [runtime-access.ts](../packages/prisma-client/src/runtime-access.ts); provisioning is [runtime-roles.mjs](../scripts/runtime-roles.mjs). These are service table/column boundaries. Most tables are not protected by per-user RLS: scoped application queries remain necessary. The vector cache additionally has actor/workspace/version RLS.

## Setup

Run from the initialized primary checkout:

```sh
pnpm db:local:start
pnpm db:migrate
pnpm db:runtime:init
pnpm auth:local:init
pnpm audit:local:init
pnpm db:test:roles
```

Setup saves five passwords in ignored .local/runtime-database.env, mode 0600, and reuses them on subsequent runs. It refuses unmanaged role collisions, production mode and non-managed local database destinations. It does not rotate credentials. Do not initialize competing credentials in a worktree: PostgreSQL role passwords are cluster-wide.

Restart the personal stack with `pnpm dev:personal`. The launcher loads the primary checkout's private runtime and transport files. Administrator DATABASE_URL is for migrations/disposable database tests and is not a runtime fallback.

## Grant summary

| Role | Allowed boundary |
| --- | --- |
| rf_local_auth | Identity/OAuth/session reads and inserts; limited session revocation/replacement updates; personal Workspace bootstrap; selected profile onboarding columns. |
| rf_local_profile | Profile and separate contact reads/inserts/updates; Education, Experience, Skill, UserProject and Certification CRUD; scoped Workspace reads; AuditOutbox insert. |
| rf_local_resume | Resume/version reads/inserts, allowlisted Resume updates; empty UserProfile FK anchor and selected ownership columns; scoped Workspace reads; ResumeSearchChunk read/insert/delete; AuditOutbox insert. |
| rf_local_audit_relay | Outbox read and limited delivery/lease/backoff/acknowledgement updates; no event-payload mutation or domain access. |
| rf_local_audit_ingest | Scoped Workspace reads; AuditEvent insert and id/payloadHash reads for idempotency; no domain/outbox access. |

Section and vector-cache DELETE grants are intentional. Resume deletion is a tombstone update; immutable versions remain. No runtime role can update/delete/truncate audit history or obtain object ownership, grant options, administrative attributes, memberships, schema creation or general DDL. Migration administration can still alter data.

Startup assertions check effective table/column grants and deny administrative credentials, excessive privileges and ownership. Database identity does not authenticate an HTTP caller. Authenticated actors and separate internal HTTP keys remain required.

## Delivery and schema changes

Run `pnpm audit:serve:local` and `pnpm audit:worker:local` in separate primary-checkout terminals. The recipient is audit-only on 4005; it does not activate workspace APIs. One delivery pass is `pnpm audit:deliver:local`.

New objects have no automatic runtime grant. Review the allowlist and rerun initialization after a grant-affecting migration. Provisioning failure rolls back SQL; preserve the saved credential file for retry.

Current role tests use disposable synthetic databases/temporary roles. Contact permission/event coverage and shared RBAC do not yet satisfy the full planned policy; see [audit findings](implementation-audit.md#priority-findings-in-existing-source). Do not infer F14/F15 completion from database isolation alone.
