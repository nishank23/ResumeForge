# Local runtime database roles

The local development database now separates migration/test administration from service access. The [PostgreSQL 18 GRANT contract](https://www.postgresql.org/docs/18/sql-grant.html) distinguishes table/column grants from ownership; application roles own no objects and receive no grant options or administrative attributes. The versioned allowlist is `packages/prisma-client/src/runtime-access.ts`; the operator transaction is `scripts/runtime-roles.mjs`.

## Setup and verification

From the repository root:

```sh
pnpm db:local:start
pnpm db:migrate
pnpm db:runtime:init
pnpm db:test:roles
```

Expect `Restricted local database roles ready` from setup, and 12 passes with zero failures from the role tests. Setup generates four distinct passwords into ignored `.local/runtime-database.env`, mode 0600, before applying grants. A failed setup transaction can be retried with the same saved credentials. Repeating setup preserves passwords and reapplies only the allowlisted privileges. No password or URL is printed. It reads only the managed local admin configuration on 127.0.0.1:55432/resume_forge_dev and refuses production mode. Hosted provisioning is not implemented.

Restart `pnpm dev` after setup. OAuth settings still come from the root `.env`; auth database access now comes exclusively from the ignored runtime file. Root/process `DATABASE_URL` values cannot provide an administrative fallback to the running auth or audit services. Prisma migrations and disposable database tests continue using `.local/database.env` (or their explicit test URL); do not replace the migration credential with a runtime URL.

## Service grants

| Service / database role            | Allowed access                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth / `rf_local_auth`             | SELECT/INSERT identity, OAuthAccount and Session rows; UPDATE only Session.revokedAt/replacedById; SELECT/INSERT Workspace for existing personal bootstrap; SELECT only UserProfile.id/userId/onboardingCompletedAt |
| Profile / `rf_local_profile`       | SELECT/INSERT/UPDATE professional profile, separate contact and section tables; SELECT Workspace scope columns; INSERT AuditOutbox only                                                                             |
| Relay / `rf_local_audit_relay`     | SELECT AuditOutbox and UPDATE only delivery state/attempt/backoff/lease/acknowledgement fields; cannot change event ID or payload, insert/delete intents or access domain data                                      |
| Ingestor / `rf_local_audit_ingest` | SELECT Workspace scope columns; INSERT AuditEvent and SELECT only its id/payloadHash for idempotency; no outbox/domain access                                                                                       |

No runtime role has DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN, schema/database CREATE, TEMP, replication, role/database creation, superuser or RLS bypass rights. Roles have no memberships, object ownership or inherited administrative access. No runtime role can UPDATE/DELETE/TRUNCATE AuditEvent history. The admin/migration operator can still alter history; the separate retention process and its authorization remain pending.

The auth service's `/auth/me` query now selects only onboarding completion from the profile relation. Profile capture uses a non-returning batch INSERT so the producer does not need SELECT on the outbox. The existing capture transaction, duplicate-event rollback and fail-closed contact-read semantics are retained. The subsequent [professional profile API](profile-api.md) uses this role for scoped GET/PUT and owned-workspace denial capture; profile creation and the wizard remain pending. Auth-owned personal workspace bootstrap is an existing local exception; future extraction to workspace-service remains pending.

Each running auth/profile/audit entry point checks the actual database role and effective table AND column privileges before serving or delivering. Administrative credentials, missing/extra grants, membership, ownership, audit modification rights and executable public functions fail startup. Error messages omit credentials and database internals. The internal audit HTTP identity remains a separate check; a database role does not authenticate an HTTP caller.

## New migrations and recovery

New objects receive no automatic runtime grants. Public table/schema privileges and [default function privileges](https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html) are revoked for the migration owner. Changes to the allowlist need review and verification; rerun `pnpm db:runtime:init` after migrations before restarting services. Existing separately granted column ACLs are also removed before the approved matrix is reapplied. Unmanaged role-name collisions or roles with unexpected ownership/memberships abort the transaction rather than modifying unrelated roles.

Keep the ignored runtime credential file. Do not delete it as a reset procedure. Automated credential rotation, deployed credential management and hosted role provisioning are not implemented. Setup reuses credentials; it does not rotate them. Database changes are transactional; a failure rolls back partial password/grant changes. Any unrelated grants to PUBLIC in this dedicated development database are intentionally removed as part of the deny-by-default policy.

To check the audit service manually, keep `pnpm audit:serve:local` running in a second terminal after `pnpm audit:local:init`. In another terminal run `pnpm audit:deliver:local`; an empty queue reports all zero counts. A credential-free POST to `/internal/audit/events` must still return HTTP 401. `pnpm db:test:roles` proves nonempty profile capture → restricted relay → authenticated HTTP → restricted ledger ingestion and duplicate-safe retry. It also checks forbidden SQL, DDL, newly created objects, column-grant drift and provisioning rollback using disposable synthetic databases and temporary roles, removed afterward. Existing checks are `pnpm db:test`, `pnpm db:test:audit` and `pnpm --filter @resume-forge/auth-service test:db`.

These are service table boundaries, not per-user row-level security. Profile service queries need authenticated actor, action, workspace and resource authorization; scoped professional GET/PUT now enforce those checks, but raw service SQL can access rows in its permitted tables. Shared role bundles, broader denied-action capture, contacts/sections, hosted relay supervision, hosted identity/network policy and audit retention remain pending. F03/F15 are not complete.

Automatic local delivery is available with `pnpm audit:worker:local`; it uses the restricted relay connection and checks access before every pass. See [worker verification](database-foundation.md#automatic-local-audit-worker--2026-10-02). Role tests now include scheduled restart/lease recovery and SQL timeout cancellation (12 passes).
