# Backend Handoff: Multi-Tenant Workspaces (F13), RBAC & Privacy (F14), and Audit Event Viewer (F15)

## Audit disposition — 2026-10-11

This is a historical backend handoff. Its source was integrated, but its original completion/test counts are not fresh audit results or proof of live gateway exposure. [Current feature status and safety findings](../implementation-audit.md) supersede activation claims here. Profile section handlers exist without connected browser forms; JD-history/generator/gap/clone/version handlers remain personal-runtime gated; shared workspace APIs remain disconnected.

Shared release is incomplete: contact permissions/events, viewer grants, safe startup and invite/consent integration must be repaired. Do not treat this handoff as complete Phase 4 acceptance.

- **Task**: Multi-tenant workspace management (F13), RBAC (F14), and audit viewing (F15)
- **Branch**: `codex/backend`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented the complete Phase 4 Multi-Tenant Workspace architecture in `services/workspace-service`, delivering organization and vendor collaboration, granular RBAC, field-level privacy (D05), and an authenticated Audit Event Viewer (F15):

1. **Workspace Management (F13)**:
   - **Workspace Creation (`POST /api/v1/workspaces`)**:
     - Supports `type: "organization"` and `type: "vendor"`.
     - Creates `Workspace` + `Organization` / `Vendor` records in PostgreSQL.
     - Automatically generates unique lowercase alphanumeric slugs with collision handling (e.g. `acme-innovations-1`).
     - The creator is automatically added as `role: "owner"`, `status: "active"` in `WorkspaceMembership`.
     - Emits transactional audit event `member.role_changed`.
   - **Workspace Listing (`GET /api/v1/workspaces`)**:
     - Lists all workspaces accessible by the authenticated actor: their personal workspace (`type: "individual"`) plus all organization and vendor workspaces where they hold active or invited memberships.
   - **Workspace Details (`GET /api/v1/workspaces/:id`) & Update (`PATCH /api/v1/workspaces/:id`)**:
     - Accessible by authorized members; settings update requires `workspace.settings.manage` (`owner` or `admin`).
     - Emits transactional audit event `workspace.settings_updated`.
   - **Context Switching (`POST /api/v1/workspaces/:id/switch`, `GET /api/v1/workspaces/:id/context`)**:
     - Authoritatively resolves actor membership and returns active workspace info, role, and the exact set of resolved permissions.
   - **Profile-Workspace Grants (D03)**:
     - `POST /api/v1/workspaces/:id/grants`: Profile owner explicitly grants profile access (`canReadProfile`, `canWriteProfile`, `canReadContact`) to a shared workspace. Rejects non-owners with `403 forbidden`.
     - `GET /api/v1/workspaces/:id/grants`: Lists active grants for the workspace.
     - `DELETE /api/v1/workspaces/:id/grants/:grantId`: Revokes grant (`revokedAt = now()`) and records `profile.access_revoked`.

2. **Member Management & Last-Owner Protection (F13 / F14)**:
   - **Invite Member (`POST /api/v1/workspaces/:id/members`)**:
     - Requires `user.invite` or `workspace.members.manage`.
     - Inviting as `owner` is disallowed directly (owner promotion must be explicit).
     - Resolves target user by `email` or `userId`. If user does not yet exist, creates placeholder user so the invitation is anchored.
     - Rejects duplicate active memberships with `409 already_member`.
     - Emits audit event `member.invited`.
   - **List Members (`GET /api/v1/workspaces/:id/members`)**:
     - Requires `workspace.members.view`.
     - Returns member list with user information (`id`, `name`, `email`).
     - **Contact Privacy (D05)**: For vendor workspaces and users without `profile.contact.read`, user email is sanitized/omitted. Auth passwords, tokens, and OAuth credentials are never queried or leaked.
   - **Update Member (`PATCH /api/v1/workspaces/:id/members/:memberId`)**:
     - Requires `workspace.members.manage`.
     - Admins cannot promote anyone to `owner` or modify an `owner` membership (403 forbidden).
     - **Last-Owner Protection**: Demoting or suspending the sole active owner of a workspace is strictly rejected with `409 last_owner_protection` (`"Cannot demote or suspend the last active owner of the workspace"`).
     - Emits audit event `member.role_changed` or `member.suspended`.
   - **Remove Member (`DELETE /api/v1/workspaces/:id/members/:memberId`)**:
     - Requires `user.remove` or self-removal. Admins cannot remove owners.
     - **Last-Owner Protection**: Removing the sole active owner of a workspace is strictly rejected with `409 last_owner_protection` (`"Cannot remove the last active owner of the workspace"`).
     - Emits audit event `member.removed`.

3. **RBAC & Field Privacy (F14)**:
   - Implemented `services/workspace-service/src/rbac.ts` adhering to the canonical 27-permission catalog from `context/authorization-model.md`.
   - Roles:
     - `owner` (Org): All 27 permissions including `profile.contact.read`, `profile.contact.update`, `audit.view`, `workspace.members.manage`, `user.invite`, `user.remove`.
     - `owner` (Vendor): Full suite except `profile.contact.read` and `profile.contact.update` (denied per D05 draft).
     - `admin` (Org/Vendor): Admin suite (`user.invite`, `user.remove`, `workspace.members.manage`, `workspace.settings.manage`, `audit.view`), cannot elevate to owner or alter protected owners.
     - `member`: `workspace.members.view`, `workspace.settings.view`, `resume.read`, `resume.create`, `resume.update`, `ats.view`, `ats.run`, `skillgap.analyze`.

4. **Audit Event Viewer (F15)**:
   - `GET /api/v1/workspaces/:id/audit-events`:
     - Requires `audit.view` permission (accessible by `owner` and `admin`). Non-privileged members receive `403 forbidden`.
     - Supports pagination (`limit` up to 100, `cursor` pagination by timestamp), and filtering by action (e.g. `?action=member.invited`).
     - **Tenant Isolation**: Strictly scoped to `workspaceId = :id`. Events from Workspace A never leak into Workspace B.

---

## 2. Files Modified & Created

- `services/workspace-service/src/contracts.ts` (created) — Zod schemas (`createWorkspaceSchema`, `updateWorkspaceSchema`, `inviteMemberSchema`, `updateMemberSchema`, `createGrantSchema`, `auditEventsQuerySchema`), TypeScript DTOs, and `WorkspaceError`.
- `services/workspace-service/src/rbac.ts` (created) — RBAC role-to-permission mapping and assertion helpers with vendor contact privacy enforcement.
- `services/workspace-service/src/workspace.ts` (created) — Complete domain use cases for workspace lifecycle, member management, last-owner protection, profile grants, and audit viewing.
- `services/workspace-service/src/app.ts` (modified) — Main Hono application exporting `createWorkspaceApp`, retaining existing `createWorkspaceAuditApp`, and registering all REST endpoints with CORS and authentication.
- `services/workspace-service/src/index.ts` (created) — Standalone server entrypoint on port 4003.
- `services/workspace-service/package.json` (modified) — Updated test scripts to run unit and DB integration test suites.
- `services/workspace-service/test/rbac.test.mjs` (created) — 4 unit tests covering permission resolution, 27-permission catalog check, and vendor contact privacy.
- `services/workspace-service/test/workspace-routes.test.mjs` (created) — 6 unit tests covering HTTP route validation, authentication, and responses.
- `services/workspace-service/test/workspace.db.test.mjs` (created) — 10 end-to-end integration tests using real PostgreSQL 18.3 verifying org/vendor creation, member invitation, last-owner protection, D03 profile grants, and F15 audit viewer.
- `docs/handoffs/backend-multi-tenant-workspaces.md` (created) — This handoff document.

---

## 3. Test & Verification Results

### Unit Tests
- `node --test test/transport.test.mjs test/worker.test.mjs test/rbac.test.mjs test/workspace-routes.test.mjs`
  - Total: **26 tests, 26 passing, 0 failing**.
  - Duration: ~270ms.

### Database Integration Tests
- `pnpm --filter @resume-forge/workspace-service test:db`
  - Runs in real local PostgreSQL 18.3 with automatic disposable test database creation and Prisma migration:
  - `test/audit.test.mjs`: **11 tests passing**.
  - `test/workspace.db.test.mjs`: **10 tests passing**:
    - Organization workspace creation (owner role, slug generation, audit outbox)
    - Vendor workspace creation (slug collision handling)
    - Workspace listing (personal + shared)
    - Settings update and audit logging
    - Context switching and capability resolution
    - Member invitations and duplicates rejection
    - Last-owner protection (demote/suspend/remove blocked for last active owner)
    - Profile-Workspace Grants (D03) creation and revocation
    - Audit Event Viewer (F15) with pagination, action filtering, and tenant isolation
  - Total: **22 tests, 22 passing, 0 failing**.

### Monorepo Verification
- `turbo run typecheck`: **19 of 19 packages passing cleanly**.
- `pnpm --filter @resume-forge/resume-service test`: **49 of 49 tests passing**.
- `git status`: Zero untracked or unwanted changes; `pnpm-lock.yaml` restored and untouched.
