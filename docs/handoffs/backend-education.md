# Backend Handoff: Owned Education List & Add API

- **Task**: Implement only owned Education list/add APIs and relevant tests under F04.
- **Branch**: `codex/backend`
- **Base Commit**: `049c63f97a470ca8666d5f0b2de58367c454b462`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented the owned Education section API (list and add) in `services/profile-service`, following the established patterns from the Work Experience API:

- Actor resolution & personal workspace authorization (validating actor expiration and workspace scope).
- Server-derived profile ownership and parent `UserProfile` optimistic concurrency control via `revision`.
- Row-level `FOR SHARE` lock during reads to ensure list snapshot consistency during concurrent writes.
- Strict schema validation with date bounds (YYYY or YYYY-MM), range checks (end requires start, reversed ranges rejected), string trimming, length bounds, and strict rejection of unauthorized/mass-assignment fields.
- Atomic mutation and content-free audit logging using `withPersonalAuditTransaction`.
- Closed-failure handling for section limits (max 50 entries) and legacy overflow.
- Preservation of separate contacts, other profile fields, and completed onboarding status.

### Files Modified & Created

- `services/profile-service/src/education-contracts.ts` (created) — Zod schemas and DTO types for creation, output, and list.
- `services/profile-service/src/profile.ts` (modified) — Use cases `listEducation` and `addEducation` with database operations, share locks, and transactional audit.
- `services/profile-service/src/app.ts` (modified) — Hono route registration and request dispatch for `GET` and `POST` on `/api/v1/profile/education`, including CORS support.
- `services/profile-service/package.json` (modified) — Updated `test:db` script to include `test/education.test.mjs`.
- `services/profile-service/test/route.test.mjs` (modified) — Route-level unit tests for auth, dispatch, unsupported methods/children, and CORS on `/api/v1/profile/education`.
- `services/profile-service/test/education.test.mjs` (created) — 14 end-to-end database integration test scenarios using disposable PostgreSQL databases and restricted runtime roles.
- `docs/handoffs/backend-education.md` (created) — This handoff document.

---

## 2. API Contract Specification

### `GET /api/v1/profile/education`

- **Permission**: `profile.read`
- **Headers**:
  - `Authorization: Bearer <token>`
  - Optional `X-Workspace-Id: <workspaceId>` (must match personal workspace)
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "profileId": "UUID",
      "revision": 1,
      "entries": [
        {
          "id": "UUID",
          "institution": "University Name",
          "degree": "Degree Name",
          "fieldOfStudy": "Field of Study",
          "startDate": "2018-09",
          "endDate": "2022-05",
          "gpa": "3.9/4.0",
          "description": "Graduated with honors",
          "sortOrder": 0
        }
      ]
    },
    "requestId": "UUID"
  }
  ```
- **Audit**: Action `profile.viewed`, resourceType `profile`, metadata `{ permission: "profile.read", status: "education_read" }`.

### `POST /api/v1/profile/education`

- **Permission**: `profile.update`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
  - Optional `X-Workspace-Id: <workspaceId>` (must match personal workspace)
- **Request Body**:
  ```json
  {
    "expectedRevision": 1,
    "institution": "University Name",
    "degree": "Degree Name",
    "fieldOfStudy": "Field of Study",
    "startDate": "2018-09",
    "endDate": "2022-05",
    "gpa": "3.9/4.0",
    "description": "Graduated with honors"
  }
  ```
  - `expectedRevision`: required positive integer <= 2,147,483,646.
  - `institution`: string, trimmed, 1–200 characters.
  - `degree`: string, trimmed, 1–200 characters.
  - `fieldOfStudy`: string, trimmed, 1–200 characters.
  - `startDate`: string matching `^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$`, nullable, defaults to `null`.
  - `endDate`: string matching `^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$`, nullable, defaults to `null`.
  - `gpa`: string, trimmed, max 50 characters, nullable, defaults to `null`.
  - `description`: string, trimmed, max 1,000 characters, nullable, defaults to `null`.
  - `strict()`: rejects unknown/mass-assignment fields (`id`, `profileId`, `sortOrder`, `revision`, `contact`, etc.).
  - Date validation: `endDate` requires `startDate`; `endDate >= startDate`.
- **Response**: `201 Created`
  ```json
  {
    "data": {
      "profileId": "UUID",
      "revision": 2,
      "entry": {
        "id": "UUID",
        "institution": "University Name",
        "degree": "Degree Name",
        "fieldOfStudy": "Field of Study",
        "startDate": "2018-09",
        "endDate": "2022-05",
        "gpa": "3.9/4.0",
        "description": "Graduated with honors",
        "sortOrder": 0
      }
    },
    "requestId": "UUID"
  }
  ```
- **Error Codes**:
  - `401 unauthenticated`: Missing, expired, or invalid credentials.
  - `403 forbidden`: Forged workspace selector or unauthorized user.
  - `404 not_found`: Master profile does not exist.
  - `409 revision_conflict`: `expectedRevision` does not match current master revision.
  - `409 section_limit`: Profile already has 50 education entries, or sortOrder ceiling reached.
  - `413 invalid_input`: Request body exceeds 32 KiB limit.
  - `415 invalid_input`: Content-Type is not application/json.
  - `422 invalid_input`: Query parameters present, or schema validation failure.
  - `503 profile_unavailable`: Oversized legacy section, database outage, or transactional audit failure.
- **Audit**: Action `profile.updated`, resourceType `profile`, metadata `{ permission: "profile.update", status: "education_added" }`.

---

## 3. Verification & Test Results

### Automated Test Runs

1. **Unit & Route Tests**:
   - Command: `pnpm --filter @resume-forge/profile-service test`
   - Result: **10/10 PASS** (all route assertions passing, including education list/add and unsupported verbs/paths rejection).
2. **Linting & Typechecking**:
   - Command: `pnpm --filter @resume-forge/profile-service lint && pnpm --filter @resume-forge/profile-service typecheck`
   - Result: **0 errors**; strict TypeScript and ESLint standards satisfied.
3. **Database Integration Tests**:
   - Command: `pnpm db:test:profile`
   - Result: **59/59 PASS** (14 Education scenarios + 21 Experience scenarios + 21 Profile scenarios + 3 suite roots).
   - Test suite runs against disposable local PostgreSQL databases (`rf_education_test_*`, `rf_experience_test_*`, `rf_profile_test_*`) with provisioned runtime roles (`profile`, `auth`, `auditRelay`, `auditIngest`).

### Tested Scenarios for Education

- Missing profile and unauthenticated requests return 401/404 without data leak or audit outbox entry.
- `GET` returns only owned entries in ascending `sortOrder`, then `id`.
- `POST` trims strings, appends entry, increments parent `revision`, and writes content-free audit outbox event.
- Omission of optional fields (`startDate`, `endDate`, `gpa`, `description`) defaults to `null`.
- Stale revision retry returns 409 `revision_conflict` without duplicate rows or orphan audit events.
- Strict field bounds (length, empty string, regex, date range, mass-assignment fields) return 422 `invalid_input`.
- Concurrent write resolution: competing adds and draft saves elect one winner on the same revision.
- Forged workspace/profile selectors return 403 `forbidden` and record denial event in actor's workspace only.
- Section limit (50 entries) rolls back parent revision; legacy oversized list fails closed with 503.
- Sort order ceiling (2,147,483,647) returns 409 `section_limit`.
- Deferred trigger simulating audit COMMIT failure rolls back both parent revision increment and education row creation; subsequent retry succeeds.
- Parent row `FOR SHARE` lock holds revision snapshot while concurrent write waits.
- Ordinary education additions preserve completed onboarding timestamp (`onboardingCompletedAt`).
- Audit outbox events deliver through HTTP relay to `AuditEvent` table without sensitive education text in payloads.
- Token expiration/revocation and auth service unavailability fail closed before domain processing.

---

## 4. Limitations & Boundaries

- **In Scope**:
  - `GET /api/v1/profile/education`
  - `POST /api/v1/profile/education`
- **Out of Scope (Preserved for Future Slices)**:
  - Education entry update (`PUT /api/v1/profile/education/:id`) — requires reviewed update specification.
  - Education deletion and reordering — requires reviewed mutation/reorder contract.
  - Other profile sections (Skills, Projects, Certifications).
  - Contacts and resume persistence.
  - Frontend UI / onboarding wizard integration.

---

## 5. Required Shared Changes

- **None required**. The `Education` Prisma model, relations on `UserProfile`, access permissions (`profile.read`, `profile.update`), and audit event names (`profile.viewed`, `profile.updated`) already exist in canonical schemas.

---

## 6. Manual Verification Steps

1. Start local PostgreSQL:
   ```bash
   node scripts/local-db.mjs status
   ```
2. Start the profile service (or run through test suite):
   ```bash
   pnpm db:test:profile
   ```
3. Test unauthenticated request:
   ```bash
   curl -i http://127.0.0.1:4002/api/v1/profile/education
   # Expected: 401 Unauthorized with error code "unauthenticated" and Cache-Control: no-store
   ```
4. Test invalid body:
   ```bash
   curl -i -X POST http://127.0.0.1:4002/api/v1/profile/education \
     -H 'Content-Type: application/json' -d '{}'
   # Expected: 401 Unauthorized (when unauthenticated) or 422 Unprocessable Entity (when authenticated)
   ```
5. Test unsupported methods on education endpoint:
   ```bash
   curl -i -X DELETE http://127.0.0.1:4002/api/v1/profile/education
   # Expected: 404 Not Found
   ```
