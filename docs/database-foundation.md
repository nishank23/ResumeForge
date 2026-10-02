# Local database foundation

Implemented 2026-09-30: Prisma CLI/client/adapter-pg pinned together at 7.10.0, pg 8.16.3, PostgreSQL 18.3, Node 22.18.0. Prisma 7 uses a driver adapter and a separate CLI configuration; see [official Prisma 7 documentation](https://www.prisma.io/docs/orm/v7). Hosting remains deferred.

The initial migration creates User, OAuthAccount, Session, Workspace, UserProfile, UserContact and ProfileWorkspaceGrant. Foreign keys restrict deletion; no retention or cascading private-data deletion policy is silently selected. One personal workspace and master profile per user are unique. A composite profile/owner foreign key prevents grants attributed to a different user. Grant capabilities default to false. Contact reads remain explicit separate queries.

SQL CHECK constraints enforce personal workspace ownership, positive profile revisions, SHA-256 hex-shaped refresh hashes, session expiration, no self rotation, and read permission before profile write grants. Hash generation and secure token handling are future auth-service responsibilities. These CHECK constraints are intentionally maintained in migration SQL because Prisma schema syntax cannot represent them.

Database constraints are not authorization. Future server queries must authenticate the actor, validate active membership and capabilities, and recheck grants on each operation. Shared routes remain inactive. The test scoped queries demonstrate correct filters; unrestricted Prisma queries can still read any row. Do not expose this client to browser packages. Session rotation must validate same user/family, atomically revoke/replace, and detect replay; the relation alone does not implement this behavior. Onboarding completion and optimistic revision updates need application transactions.

## Verification and recovery

`pnpm db:test` generates/builds the client, migrates a fresh randomly named database, creates two synthetic users and three workspaces, tests uniqueness/foreign keys/checks/scope/revocation, verifies a failed transaction with a separate connection, then dumps and restores into another disposable database. Both are removed in a finally block. The development database receives no fixture personal data.

For development backups, use `pg_dump` with the private connection settings from `.local/database.env` and write backups outside Git. Restore into a new database and verify it before changing your connection; do not overwrite the existing cluster as a recovery shortcut. The automated test demonstrates schema/data restore for synthetic fixtures, not a production recovery guarantee. Applied migrations are immutable; later corrections need a new migration. Review any generated SQL, especially dropped columns and manually maintained CHECK constraints.

## Atomic personal audit capture (2026-10-01; verified 2026-10-02)

`withPersonalAuditTransaction(db, authenticatedActorId, intent, operation)` is available from the server-only Prisma package. It validates the existing audit-intent contract and UUID database identifiers, requires a successful event attributed to the authenticated actor, and verifies that the actor owns the individual workspace. Shared workspaces and cross-user targets are rejected. The helper does not authenticate credentials or authorize action/resource permissions: service callers must do those checks and use scoped queries in `operation`.

The callback's database work and the normalized `AuditOutbox` insert commit in one transaction. The helper resolves only after commit, so an authorized contact-read result is withheld if capture or commit fails. Callbacks must not stream results, log private values, send network requests, or perform other nontransactional side effects. No raw callback result enters the audit payload.

Duplicate event IDs reject and roll back the entire operation. This is capture uniqueness, not idempotent mutation replay; service commands need their own idempotency contract. Events initially remain pending in the producer outbox. Local delivery/retry is described below; append-only runtime privileges, denied-event capture and retention remain unfinished. No private route is activated by this helper.

`pnpm db:test` now includes five additional audit cases: atomic commit observed from another connection, invalid metadata/actor/workspace rejection, domain-failure rollback, duplicate-event rollback, and a deferred PostgreSQL trigger that forces COMMIT to fail after a contact query/outbox insert. The test verifies no contact result is released, then removes the test-only trigger and verifies recovery. It runs only in disposable synthetic databases.

## Remaining P1.3 work

Automatic audit scheduling and production service identity; scoped service repositories and least-privilege roles; private-route integration. Profile section, typed organization/vendor, membership and resume/version/task storage models already exist; their service behavior is not complete. D07 still gates vectors; D12 gates protected resume snapshots. Audit retention/deletion periods must be resolved before deploying real personal data. This slice does not complete F03.

## Local audit relay and ledger — 2026-10-02

`deliverAuditOutbox` in the server-only Prisma package claims at most 25 due rows by default (maximum 100) using parameterized PostgreSQL [queue row locking](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE). It commits a 30-second lease and increments attempts before invoking transport outside a database transaction. Acknowledgements are fenced by lease token; stalled/crashed claims become eligible after expiry. Delivery is at least once, so the recipient must be idempotent.

`ingestPersonalAuditEvent` belongs to workspace-service and is invoked by its authenticated local HTTP boundary (or trusted in-process tests). It validates content-free intent and personal ownership, inserts the event using its producer event ID, and compares a canonical SHA-256 intent hash on repeats. Equivalent retries return the existing event; conflicting reuse fails without overwriting it. Occurrence time, outcome and correlation are retained. Legacy rows retain NULL for previously absent fields. The local internal ingestion endpoint is described below; the gateway does not forward it.

Transient failures keep the event pending with a persisted exponential delay starting at 5 seconds and capped at 5 minutes; attempts continue without dropping the intent. Only fixed failure codes are recorded, never raw exceptions. Invalid payload/scope or conflicting identity becomes blocked, retained for controlled remediation. Automatic remediation is not implemented. Delivered intents are retained pending a retention decision.

From the project root:

```sh
pnpm db:local:start
pnpm db:migrate
pnpm db:test:audit
```

`db:test:audit` uses disposable synthetic databases and should print 12 passes, zero failures. It covers retries/backoff, independent connections, concurrency, lease recovery, scope denial, ledger commit followed by acknowledgement COMMIT failure, authenticated HTTP retry after a rejected credential/lost reply, and ledger COMMIT failure before HTTP acknowledgement. Existing `pnpm db:test` should still print 13 passes. These tests do not seed the development database.

The local runner ignores root/hosted DATABASE_URL values and restricts execution to the managed database on 127.0.0.1:55432. It processes one batch and prints counts only, including remaining pending/delivering/blocked backlog. With no development intents, all counts are zero. Run it again for additional batches or after the retry time/lease expiry; it is not a scheduled worker. Blocked backlog or attempted transient failures cause a nonzero exit. This slice adds no UI and no public audit query. Production service identity, least-privilege/append-only roles, denied-event capture, full service coverage and retention remain prerequisites for release.

## Authenticated local audit HTTP — 2026-10-02

The workspace app uses Hono's [Node.js adapter](https://hono.dev/docs/getting-started/nodejs) with the already locked Hono 4.13.10 / adapter 1.19.17 versions. `POST http://127.0.0.1:4005/internal/audit/events` is an internal server route. It requires both the `local-audit-relay` service ID and its generated credential, checked before body parsing or database access. It has no CORS, rejects Origin-bearing requests, and the public gateway has no forwarding route. It records previously authorized, personal-scoped history; service authentication is not a replacement for the producer's actor/action/resource checks.

The relay sends content-free validated intent, refuses redirects and non-loopback endpoints, bounds replies to 1 KiB, and uses a 3-second timeout. The route rejects actual bodies over 16 KiB, malformed JSON, unknown fields/private metadata and unsupported content types. Errors contain fixed codes only. A valid acknowledgement must match the event ID and arrives after ingestion COMMIT; missing/malformed replies, authentication failure, timeouts or service failures keep the outbox pending. Only matching permanent error/status pairs block the retained event. One 25-event operator batch uses a 120-second lease to cover its bounded transport waits; stale completion remains fenced if a process stalls longer.

From the project root, run once (repeat safely; an existing key is kept):

```sh
pnpm audit:local:init
```

The key is written with mode 0600 to ignored `.local/audit-transport.env`. Do not put it in frontend/VITE variables or send it in chat. Rotation is manual for now: stop the service, replace the key locally, then restart both readers. Existing intents survive rotation. These scripts read the ignored local files directly, ignore root/process database overrides and refuse production mode. The database is still the managed local cluster; no hosted database is contacted.

Start the recipient in a separate terminal and keep it running:

```sh
pnpm audit:serve:local
```

Expected terminal output: `Local workspace audit service listening on http://127.0.0.1:4005`.

In another terminal:

```sh
curl -i -X POST http://127.0.0.1:4005/internal/audit/events -H 'Content-Type: application/json' -d '{}'
pnpm audit:deliver:local
pnpm --filter @resume-forge/workspace-service test
pnpm db:test:audit
```

The credential-free curl must return HTTP 401 with `service_unauthorized`. The relay prints only batch/backlog counts; an empty queue prints all zeros and makes no HTTP calls, so it alone does not prove connectivity. Transport tests should show 8 passes and database tests 12 passes with zero failures. Tests create/discard synthetic databases and temporary loopback listeners; they do not add development events. Stop the recipient with Ctrl-C when finished. No new UI flow is added.

This is a local development identity, not production service authentication. Deployment credential distribution/rotation, HTTPS/network policy, automatic scheduling, restricted runtime database roles and private domain routes remain pending. Full F03/F15 acceptance is not complete.
