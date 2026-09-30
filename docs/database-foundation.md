# Local database foundation

Implemented 2026-09-30: Prisma CLI/client/adapter-pg pinned together at 7.10.0, pg 8.16.3, PostgreSQL 18.3, Node 22.18.0. Prisma 7 uses a driver adapter and a separate CLI configuration; see [official Prisma 7 documentation](https://www.prisma.io/docs/orm/v7). Hosting remains deferred.

The initial migration creates User, OAuthAccount, Session, Workspace, UserProfile, UserContact and ProfileWorkspaceGrant. Foreign keys restrict deletion; no retention or cascading private-data deletion policy is silently selected. One personal workspace and master profile per user are unique. A composite profile/owner foreign key prevents grants attributed to a different user. Grant capabilities default to false. Contact reads remain explicit separate queries.

SQL CHECK constraints enforce personal workspace ownership, positive profile revisions, SHA-256 hex-shaped refresh hashes, session expiration, no self rotation, and read permission before profile write grants. Hash generation and secure token handling are future auth-service responsibilities. These CHECK constraints are intentionally maintained in migration SQL because Prisma schema syntax cannot represent them.

Database constraints are not authorization. Future server queries must authenticate the actor, validate active membership and capabilities, and recheck grants on each operation. Shared routes remain inactive. The test scoped queries demonstrate correct filters; unrestricted Prisma queries can still read any row. Do not expose this client to browser packages. Session rotation must validate same user/family, atomically revoke/replace, and detect replay; the relation alone does not implement this behavior. Onboarding completion and optimistic revision updates need application transactions.

## Verification and recovery

`pnpm db:test` generates/builds the client, migrates a fresh randomly named database, creates two synthetic users and three workspaces, tests uniqueness/foreign keys/checks/scope/revocation, verifies a failed transaction with a separate connection, then dumps and restores into another disposable database. Both are removed in a finally block. The development database receives no fixture personal data.

For development backups, use `pg_dump` with the private connection settings from `.local/database.env` and write backups outside Git. Restore into a new database and verify it before changing your connection; do not overwrite the existing cluster as a recovery shortcut. The automated test demonstrates schema/data restore for synthetic fixtures, not a production recovery guarantee. Applied migrations are immutable; later corrections need a new migration. Review any generated SQL, especially dropped columns and manually maintained CHECK constraints.

## Remaining P1.3 work

Profile section tables; typed organization/vendor details and memberships; resume/version/task foundations after their contracts; producer-local audit outbox and idempotent delivery; scoped service repositories and least-privilege roles. D07 still gates vectors; D12 gates protected resume snapshots. Audit retention/deletion periods must be resolved before deploying real personal data. This slice does not complete F03.
