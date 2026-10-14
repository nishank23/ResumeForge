> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Backend Handoff: Profile-to-Resume Generation, Section Suggestions & Suggestion Application (F06)

## Audit disposition — 2026-10-11

This is a historical backend handoff. Its source was integrated, but its original completion/test counts are not fresh audit results or proof of live gateway exposure. [Current feature status and safety findings](../implementation-audit.md) supersede activation claims here. Profile section handlers exist without connected browser forms; JD-history/generator/gap/clone/version handlers remain personal-runtime gated; shared workspace APIs remain disconnected.

- **Task**: Profile-to-resume generation, contextual section suggestions, and suggestion application under F06.
- **Branch**: `codex/backend`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented the end-to-end backend architecture and API endpoints for generating resumes directly from master profile facts, producing reviewable grounded rewrite suggestions, and transactionally applying approved suggestions with optimistic concurrency control and immutable versioning:

1. **Profile-to-Resume Generation (`POST /api/v1/resume/generate`)**:
   - Compiles master profile facts (`UserProfile`, `UserContact`, `experiences`, `educations`, `skills`, `projects`, `certifications`) into a validated `ParsedResumeContentDto`.
   - Invariant preservation: Never invents ungrounded qualifications, maintains fact provenance from the master profile.
   - Automatically initializes version 1 in `ResumeVersion` and assigns `currentVersion = 1` in `Resume`.
   - Optionally computes initial ATS match score if `jdHistoryId` is provided.
   - Emits outbox audit event (`resume.created`).

2. **Contextual Section Suggestions (`POST /api/v1/resume/:id/suggest`)**:
   - Supports section-specific targeting (`summary`, `experience`, `skills`, `projects`) down to entry and bullet-point granularity (`entryId`, `bulletId`).
   - Supports 5 actionable prompt directives:
     - `improve_impact`: Replaces weak or passive phrasing with strong leadership action verbs.
     - `quantify`: Weaves measurable metric placeholders and impact numbers.
     - `tailor_to_jd`: Incorporates ONLY intersecting grounded skills between the user's master profile and the target Job Description (strictly prohibits hallucinating arbitrary keywords).
     - `shorten`: Condenses wordy phrasing for concise readability.
     - `rewrite`: Eliminates conversational filler and polishes tone.
   - Invariant: Suggestions are reviewable and returned with `status: "pending_review"`. Does not mutate the resume or master profile.
   - Persists execution record in `TaskRun` (`kind: "section_suggestion"`, `dispatchStatus: "completed"`).

3. **Suggestion Application & Concurrency Control (`POST /api/v1/resume/:id/apply-suggestion`)**:
   - Enforces optimistic concurrency control (`expectedVersion` must match `existing.currentVersion`; returns `409 revision_conflict` on stale edits).
   - Advances `currentVersion` (e.g., v1 -> v2) transactionally.
   - Creates an immutable record in `ResumeVersion` with the applied content.
   - Multi-resume isolation: Updating Resume 1 leaves Resume 2, Resume 3, and all other resumes completely untouched.
   - Emits outbox audit event (`resume.updated` with `reasonCode: "apply_suggestion"`).

4. **TaskRun Status & Result Retrieval (`GET /api/v1/task-run/:id`)**:
   - Retrieves background or execution results with strict actor and workspace ownership validation.

---

## 2. Files Modified & Created

- `services/resume-service/src/generator-contracts.ts` (created) — Zod schemas and DTO types for resume generation, suggestion requests, reviewable suggestion DTOs, suggestion application, and task run DTOs.
- `services/resume-service/src/content-mapper.ts` (created) — Pure mapper compiling master `UserProfileFacts` into validated `ParsedResumeContentDto`.
- `services/resume-service/src/suggestion-engine.ts` (created) — Grounded heuristic suggestion engine for `improve_impact`, `quantify`, `tailor_to_jd`, `shorten`, and `rewrite`.
- `services/resume-service/src/resume.ts` (modified) — Implemented `generateResumeFromProfile`, `generateSectionSuggestionForResume`, `applySectionSuggestion`, and `getTaskRunById`.
- `services/resume-service/src/app.ts` (modified) — Registered CORS and Hono routes for `POST /api/v1/resume/generate`, `POST /api/v1/resume/:id/suggest`, `POST /api/v1/resume/:id/apply-suggestion`, and `GET /api/v1/task-run/:id`.
- `services/resume-service/package.json` (modified) — Updated `test` and `test:db` scripts to include `test/generator.test.mjs` and `test/generator.db.test.mjs`.
- `services/resume-service/test/generator.test.mjs` (created) — 6 unit tests covering content mapping, verb enhancement, metric quantification, ungrounded hallucination prevention, and sentence shortening.
- `services/resume-service/test/route.test.mjs` (modified) — 5 new route tests for generation, suggestions, application, and task run retrieval.
- `services/resume-service/test/generator.db.test.mjs` (created) — 6 PostgreSQL integration tests covering profile facts seeding, generation, suggestion persistence in TaskRun, version incrementation, optimistic concurrency conflicts, single-resume isolation, and foreign actor denial.
- `docs/handoffs/backend-resume-generator.md` (created) — This document.

---

## 3. API Contract Specifications

### 1. `POST /api/v1/resume/generate` (Generate Resume from Master Profile)
- **Auth**: Required (`Bearer <token>`)
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "title": "Targeted Backend Resume",
    "templateId": "default",
    "jdHistoryId": "optional-uuid"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "data": {
      "id": "c62b489d-...",
      "profileId": "a11d2345-...",
      "workspaceId": "b22e3456-...",
      "title": "Targeted Backend Resume",
      "templateId": "default",
      "currentVersion": 1,
      "status": "draft",
      "atsScore": 85,
      "content": { ... },
      "createdAt": "2026-10-04T17:30:00.000Z",
      "updatedAt": "2026-10-04T17:30:00.000Z"
    },
    "requestId": "..."
  }
  ```

### 2. `POST /api/v1/resume/:id/suggest` (Generate Grounded Rewrite Suggestion)
- **Auth**: Required (`Bearer <token>`)
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "sectionKind": "experience",
    "entryId": "exp-1",
    "bulletId": "bullet-1",
    "action": "improve_impact",
    "jdHistoryId": "optional-uuid",
    "customPrompt": "optional instructions"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "taskRunId": "uuid-...",
      "suggestionId": "uuid-...",
      "sectionKind": "experience",
      "entryId": "exp-1",
      "bulletId": "bullet-1",
      "originalContent": "worked on migrating databases",
      "suggestedContent": "Engineered distributed migration pipeline for PostgreSQL databases",
      "reasoning": "Replaced passive or weak phrasing with high-impact leadership action verbs.",
      "groundedKeywords": ["PostgreSQL"],
      "status": "pending_review",
      "createdAt": "2026-10-04T17:30:00.000Z"
    },
    "requestId": "..."
  }
  ```

### 3. `POST /api/v1/resume/:id/apply-suggestion` (Apply Approved Suggestion)
- **Auth**: Required (`Bearer <token>`)
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "expectedVersion": 1,
    "sectionKind": "experience",
    "entryId": "exp-1",
    "bulletId": "bullet-1",
    "appliedContent": "Engineered distributed migration pipeline for PostgreSQL databases",
    "suggestionId": "optional-uuid"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "id": "c62b489d-...",
      "currentVersion": 2,
      "status": "draft",
      "content": { ... },
      "updatedAt": "2026-10-04T17:31:00.000Z"
    },
    "requestId": "..."
  }
  ```
- **Error (409 Conflict)** if `expectedVersion !== existing.currentVersion`:
  ```json
  {
    "error": {
      "code": "revision_conflict",
      "message": "Resume version conflict"
    },
    "requestId": "..."
  }
  ```

### 4. `GET /api/v1/task-run/:id` (Fetch Task Run Status)
- **Auth**: Required (`Bearer <token>`)
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "id": "uuid-...",
      "kind": "section_suggestion",
      "dispatchStatus": "completed",
      "taskType": "section_suggestion",
      "status": "completed",
      "result": { ... },
      "errorMessage": null,
      "resumeId": "uuid-...",
      "createdAt": "2026-10-04T17:30:00.000Z",
      "completedAt": "2026-10-04T17:30:01.000Z"
    },
    "requestId": "..."
  }
  ```

---

## 4. Verification & Automated Test Results

All verification suites pass cleanly:

- `pnpm --filter @resume-forge/resume-service build`: PASS (TypeScript build succeeded with 0 errors)
- `pnpm --filter @resume-forge/resume-service typecheck`: PASS (Clean `tsc --noEmit`)
- `pnpm --filter @resume-forge/resume-service lint`: PASS (Zero ESLint warnings or errors)
- `pnpm --filter @resume-forge/resume-service test`: PASS (40/40 unit and route tests pass)
- `pnpm --filter @resume-forge/resume-service test:db`: PASS (26/26 PostgreSQL integration tests pass)
- `pnpm typecheck` (Monorepo root): PASS (19/19 packages typecheck cleanly)
