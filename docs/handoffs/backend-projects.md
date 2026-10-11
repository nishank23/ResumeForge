# Backend Handoff: Owned Projects List, Add & Update API

## Audit disposition — 2026-10-11

This is a historical backend handoff. Its source was integrated, but its original completion/test counts are not fresh audit results or proof of live gateway exposure. [Current feature status and safety findings](../implementation-audit.md) supersede activation claims here. Profile section handlers exist without connected browser forms; JD-history/generator/gap/clone/version handlers remain personal-runtime gated; shared workspace APIs remain disconnected.

- **Task**: Implement only owned Projects list, addition, and update APIs and relevant tests under F04.
- **Branch**: `codex/backend`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented the owned Projects section API (list, add, and update) in `services/profile-service`, following the established patterns from Experience, Education, and Skills:

- Actor resolution & personal workspace authorization (validating actor expiration and workspace scope).
- Server-derived profile ownership and parent `UserProfile` optimistic concurrency control via `revision`.
- Row-level `FOR SHARE` lock on parent `UserProfile` during reads to ensure list snapshot consistency during concurrent writes.
- Strict schema validation with string trimming, length bounds (`name` max 200, `description` max 2000, `url` max 500 valid URL, `technologies` array max 30 items, dates in `YYYY` or `YYYY-MM` with chronological ordering `endDate >= startDate`), and strict rejection of unauthorized/mass-assignment fields.
- Atomic mutation and content-free audit logging using `withPersonalAuditTransaction`.
- Closed-failure handling for section limits (max 50 projects) and missing/foreign project IDs (404).
- Preservation of separate contacts, other profile fields, and completed onboarding status.

### Files Modified & Created

- `services/profile-service/src/project-contracts.ts` (created) — Zod schemas and DTO types for project creation, update, item output, and list.
- `services/profile-service/src/profile.ts` (modified) — Use cases `listProjects`, `addProject`, and `updateProject` with database operations, share locks, and transactional audit.
- `services/profile-service/src/app.ts` (modified) — Hono route registration and request dispatch for `GET` and `POST` on `/api/v1/profile/projects`, and `PUT` on `/api/v1/profile/projects/:id`, including CORS support.
- `services/profile-service/package.json` (modified) — Updated `test:db` script to include `test/project.test.mjs`.
- `services/profile-service/test/route.test.mjs` (modified) — Route-level unit tests for auth, dispatch, unsupported methods/children, and CORS on `/api/v1/profile/projects` and `/api/v1/profile/projects/:id`.
- `services/profile-service/test/project.test.mjs` (created) — 10 end-to-end database integration test scenarios using disposable PostgreSQL databases and restricted runtime roles.
- `docs/handoffs/backend-projects.md` (created) — This handoff document.

---

## 2. API Contract Specification

### `GET /api/v1/profile/projects`

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
          "name": "ResumeForge",
          "description": "AI resume management and builder",
          "url": "https://example.com/project",
          "technologies": ["TypeScript", "React", "PostgreSQL"],
          "startDate": "2024-01",
          "endDate": "2024-06"
        }
      ]
    },
    "requestId": "UUID"
  }
  ```
- **Audit**: Action `profile.viewed`, resourceType `profile`, metadata `{ permission: "profile.read", status: "projects_read" }`.

### `POST /api/v1/profile/projects`

- **Permission**: `profile.update`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
  - Optional `X-Workspace-Id: <workspaceId>` (must match personal workspace)
- **Request Body**:
  ```json
  {
    "expectedRevision": 1,
    "name": "ResumeForge",
    "description": "AI resume management and builder",
    "url": "https://example.com/project",
    "technologies": ["TypeScript", "React", "PostgreSQL"],
    "startDate": "2024-01",
    "endDate": "2024-06"
  }
  ```
  - `expectedRevision`: required positive integer <= 2,147,483,646.
  - `name`: string, trimmed, 1–200 characters.
  - `description`: string, trimmed, 1–2,000 characters.
  - `url`: valid URL string, trimmed, max 500 characters, nullable, defaults to `null`.
  - `technologies`: array of trimmed strings (1–50 chars), max 30 items, defaults to `[]`.
  - `startDate`: string matching `^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$`, nullable, defaults to `null`.
  - `endDate`: string matching `^[1-9]\d{3}(?:-(?:0[1-9]|1[0-2]))?$`, nullable, defaults to `null`.
  - Date validation: `endDate >= startDate`.
  - `strict()`: rejects unknown/mass-assignment fields (`id`, `profileId`, `revision`, `contact`, etc.).
- **Response**: `201 Created`
  ```json
  {
    "data": {
      "profileId": "UUID",
      "revision": 2,
      "entry": {
        "id": "UUID",
        "name": "ResumeForge",
        "description": "AI resume management and builder",
        "url": "https://example.com/project",
        "technologies": ["TypeScript", "React", "PostgreSQL"],
        "startDate": "2024-01",
        "endDate": "2024-06"
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
  - `409 section_limit`: Profile already has 50 projects.
  - `413 invalid_input`: Request body exceeds 32 KiB limit.
  - `415 invalid_input`: Content-Type is not application/json.
  - `422 invalid_input`: Query parameters present, schema validation failure, or invalid URL/dates.
  - `503 profile_unavailable`: Oversized legacy section, database outage, or transactional audit failure.
- **Audit**: Action `profile.updated`, resourceType `profile`, metadata `{ permission: "profile.update", status: "project_added" }`.

### `PUT /api/v1/profile/projects/:id`

- **Permission**: `profile.update`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
  - Optional `X-Workspace-Id: <workspaceId>` (must match personal workspace)
- **Path Parameters**:
  - `:id`: UUID of the existing project entry.
- **Request Body**:
  ```json
  {
    "expectedRevision": 2,
    "name": "Updated ResumeForge",
    "description": "Updated project description",
    "url": "https://example.com/updated",
    "technologies": ["TypeScript", "Next.js"],
    "startDate": "2024-02",
    "endDate": "2024-07"
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
        "name": "Updated ResumeForge",
        "description": "Updated project description",
        "url": "https://example.com/updated",
        "technologies": ["TypeScript", "Next.js"],
        "startDate": "2024-02",
        "endDate": "2024-07"
      }
    },
    "requestId": "UUID"
  }
  ```
- **Error Codes**:
  - `401 unauthenticated`: Missing or invalid bearer token.
  - `403 forbidden`: Foreign workspace or unauthorized user.
  - `404 not_found`: Project entry does not exist or belongs to another user.
  - `409 revision_conflict`: `expectedRevision` does not match current master revision.
  - `422 invalid_input`: Invalid input schema or UUID format.
- **Audit**: Action `profile.updated`, resourceType `profile`, metadata `{ permission: "profile.update", status: "project_updated" }`.

---

## 3. Verification & Test Results

### Automated Test Runs

1. **Unit & Route Tests**:
   - Command: `pnpm --filter @resume-forge/profile-service test`
   - Result: **12/12 PASS** (all route assertions passing, including projects list/add/update and unsupported verbs/paths rejection).
2. **Linting & Typechecking**:
   - Command: `pnpm --filter @resume-forge/profile-service lint && pnpm --filter @resume-forge/profile-service typecheck`
   - Result: **0 errors**; strict TypeScript and ESLint standards satisfied.
3. **Database Integration Tests**:
   - Command: `pnpm db:test:profile`
   - Result: **83/83 PASS** (10 Projects scenarios + 8 Skills scenarios + 14 Education scenarios + 21 Experience scenarios + 21 Profile scenarios + 9 suite roots).
   - Test suite runs against disposable local PostgreSQL databases (`rf_project_test_*`, `rf_skill_test_*`, `rf_education_test_*`, `rf_experience_test_*`, `rf_profile_test_*`) with provisioned runtime roles (`profile`, `auth`, `auditRelay`, `auditIngest`).

---

## 4. Manual Verification Steps

1. **Check local database cluster status**:
   ```bash
   node scripts/local-db.mjs status
   ```
2. **Run all profile, experience, education, skills, and project integration tests**:
   ```bash
   pnpm db:test:profile
   ```
3. **Test unauthenticated access (fails closed with 401)**:
   ```bash
   curl -i http://127.0.0.1:4002/api/v1/profile/projects
   # Expected: 401 Unauthorized with error code "unauthenticated" and Cache-Control: no-store
   ```
4. **Test invalid payload rejection (fails with 422)**:
   ```bash
   curl -i -X POST http://127.0.0.1:4002/api/v1/profile/projects \
     -H 'Content-Type: application/json' -d '{"expectedRevision": 1, "name": ""}'
   # Expected: 401 Unauthorized (unauthenticated) or 422 Unprocessable Entity (authenticated)
   ```
5. **Test unsupported methods (404)**:
   ```bash
   curl -i -X DELETE http://127.0.0.1:4002/api/v1/profile/projects
   # Expected: 404 Not Found
   ```
