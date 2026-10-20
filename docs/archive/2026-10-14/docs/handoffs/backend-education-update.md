> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Backend Handoff: Owned Education Entry Updates

## Audit disposition — 2026-10-11

This is a historical backend handoff. Its source was integrated, but its original completion/test counts are not fresh audit results or proof of live gateway exposure. [Current feature status and safety findings](../implementation-audit.md) supersede activation claims here. Profile section handlers exist without connected browser forms; JD-history/generator/gap/clone/version handlers remain personal-runtime gated; shared workspace APIs remain disconnected.

- **Task**: Implement owned Education entry updates (`PUT /api/v1/profile/education/:id`) under F04.
- **Branch**: `codex/backend`
- **Base Commit**: `9d5e2d929941a879976df47ea875d654f590656a`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented the owned Education entry update API (`PUT /api/v1/profile/education/:id`) in `services/profile-service`, matching the contract, concurrency, and audit patterns established for Work Experience entry updates:

- **Full Allowlisted Field Replacement**: Explicitly replaces all allowlisted professional fields on an owned education entry (`institution`, `degree`, `fieldOfStudy`, `startDate`, `endDate`, `gpa`, `description`) plus `expectedRevision`.
- **Nullable Clearing Semantics**: Supports explicit `null` to clear nullable fields (`startDate`, `endDate`, `gpa`, `description`).
- **Strict Validation & Precision**: Reuses established date regex (`YYYY` or `YYYY-MM`), date range ordering (`endDate` requires `startDate`; `endDate >= startDate`), string trimming, length bounds (institution/degree/fieldOfStudy 1–200, gpa max 50, description max 1,000), and rejects mass assignment/forbidden fields (`id`, `profileId`, `sortOrder`, `revision`, `contact`, `onboardingCompletedAt`).
- **Optimistic Concurrency Control**: Validates and increments the shared parent `UserProfile.revision`. Competing writes (updates, additions, draft saves) elect one winner; stale revisions return `409 revision_conflict` before modifying rows.
- **Preservation & Tenant Isolation**: Target ID, `sortOrder`, other education entries, `UserContact` rows, and `onboardingCompletedAt` remain unchanged. Missing or foreign entry IDs return `404 not_found` without advancing the parent revision.
- **Atomic Transactional Audit**: Captures content-free audit outbox entry atomically with `withPersonalAuditTransaction` (`action: "profile.updated"`, `resourceType: "profile"`, metadata `{ permission: "profile.update", status: "education_updated" }`).
- **HTTP Routing & Local CORS**: Registered `PUT /api/v1/profile/education/:id` with scoped local CORS (`http://localhost:3000`) and standard `Cache-Control: no-store`.

### Files Modified

- `services/profile-service/src/education-contracts.ts` — Added `educationUpdateSchema`.
- `services/profile-service/src/profile.ts` — Added `updateEducation` use case with atomic parent lock, child update, and audit capture.
- `services/profile-service/src/app.ts` — Registered `PUT /api/v1/profile/education/:id`, added local CORS, and wired route dispatch.
- `services/profile-service/test/route.test.mjs` — Added route unit tests verifying dispatch, CORS preflight, and unsupported method/sub-path rejection.
- `services/profile-service/test/education.test.mjs` — Added database integration tests covering replacements, nullable clears, validation errors, foreign target isolation, competing writes, audit delivery, and onboarding preservation.
- `docs/handoffs/backend-education-update.md` — This handoff document.

---

## 2. API Contract Specification

### `PUT /api/v1/profile/education/:id`

- **Permission**: `profile.update`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
  - Optional `X-Workspace-Id: <workspaceId>` (must match personal workspace)
- **Path Parameter**:
  - `id`: UUID of the education entry to update.
- **Request Body**:
  ```json
  {
    "expectedRevision": 2,
    "institution": "Stanford University",
    "degree": "M.S.",
    "fieldOfStudy": "Computer Science",
    "startDate": "2020-09",
    "endDate": "2022-06",
    "gpa": "3.95",
    "description": "Specialization in Artificial Intelligence"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "profileId": "UUID",
      "revision": 3,
      "entry": {
        "id": "UUID",
        "institution": "Stanford University",
        "degree": "M.S.",
        "fieldOfStudy": "Computer Science",
        "startDate": "2020-09",
        "endDate": "2022-06",
        "gpa": "3.95",
        "description": "Specialization in Artificial Intelligence",
        "sortOrder": 0
      }
    },
    "requestId": "UUID"
  }
  ```
- **Error Codes**:
  - `401 unauthenticated`: Missing, expired, or invalid credentials.
  - `403 forbidden`: Forged workspace selector.
  - `404 not_found`: Master profile or education entry does not exist, or belongs to another user.
  - `409 revision_conflict`: `expectedRevision` does not match parent profile revision.
  - `413 invalid_input`: Request body exceeds 32 KiB limit.
  - `415 invalid_input`: Content-Type is not application/json.
  - `422 invalid_input`: Schema validation failure (missing required field, invalid date range, string bounds exceeded, query parameters present).
  - `503 profile_unavailable`: Database outage or audit transaction failure.
- **Audit**: Action `profile.updated`, resourceType `profile`, metadata `{ permission: "profile.update", status: "education_updated" }`.

---

## 3. Verification & Test Results

### Automated Test Runs

1. **Unit & Route Tests**:
   - Command: `pnpm --filter @resume-forge/profile-service test`
   - Result: **10/10 PASS** (all route assertions passing, including `PUT /api/v1/profile/education/:id` dispatch and preflight).
2. **Linting & Typechecking**:
   - Command: `pnpm --filter @resume-forge/profile-service lint && pnpm --filter @resume-forge/profile-service typecheck`
   - Result: **0 errors**; strict TypeScript and ESLint standards satisfied.
3. **Database Integration Tests**:
   - Command: `pnpm db:test:profile`
   - Result: **64/64 PASS**:
     - Education suite (`test/education.test.mjs`): **20/20 PASS** (includes replacement, nullable clearing, strict validation, foreign isolation, competing writes, audit delivery, and onboarding preservation).
     - Experience suite (`test/experience.test.mjs`): **22/22 PASS**.
     - Profile suite (`test/profile.test.mjs`): **22/22 PASS**.
4. **Monorepo Tests Check**:
   - `pnpm db:test`: **14/14 PASS**.
   - `pnpm db:test:audit`: **12/12 PASS**.
   - `pnpm db:test:roles`: **12/12 PASS**.
   - `pnpm --filter @resume-forge/resume-service test`: **15/15 PASS**.
   - `pnpm --filter @resume-forge/resume-service test:db`: **6/6 PASS**.

---

## 4. Manual Verification Steps

1. Start local PostgreSQL:
   ```bash
   node scripts/local-db.mjs status
   ```
2. Run automated profile database test suite:
   ```bash
   pnpm db:test:profile
   ```
3. Test unauthenticated PUT rejection:
   ```bash
   curl -i -X PUT http://127.0.0.1:4002/api/v1/profile/education/11111111-1111-4111-8111-111111111111 \
     -H 'Content-Type: application/json' -d '{}'
   # Expected: 401 Unauthorized with code "unauthenticated" and Cache-Control: no-store
   ```
4. Test invalid body / missing fields:
   ```bash
   curl -i -X PUT http://127.0.0.1:4002/api/v1/profile/education/11111111-1111-4111-8111-111111111111 \
     -H 'Content-Type: application/json' -d '{"expectedRevision": 1}'
   # Expected: 401 (unauthenticated) or 422 (when authenticated with missing fields)
   ```
