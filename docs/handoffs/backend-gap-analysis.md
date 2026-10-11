# Backend Handoff: Keyword & Skill Gap Analysis (F17) and JD History Deletion (F11)

## Audit disposition — 2026-10-11

This is a historical backend handoff. Its source was integrated, but its original completion/test counts are not fresh audit results or proof of live gateway exposure. [Current feature status and safety findings](../implementation-audit.md) supersede activation claims here. Profile section handlers exist without connected browser forms; JD-history/generator/gap/clone/version handlers remain personal-runtime gated; shared workspace APIs remain disconnected.

- **Task**: Keyword & Skill Gap Analysis and JD History Deletion under F11/F17.
- **Branch**: `codex/backend`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented grounded Keyword & Skill Gap Analysis (`POST /api/v1/resume/:id/gap-analysis`, `GET /api/v1/resume/:id/gap-analysis`) and scoped Job Description deletion with foreign-key reference nullification (`DELETE /api/v1/jd/:id`, `DELETE /api/v1/jd/history/:id`):

1. **Keyword & Skill Gap Analysis (F17)**:
   - Evaluates a target `Resume` against a target `JD` (provided via `jdHistoryId`, `rawJD`, or previously linked `resume.jdHistoryId`).
   - Grounded comparison against Master Profile facts (`UserProfile`, `Experience`, `Skill`, `UserProject`, `Education`, `Certification`).
   - Categorizes requirements and keywords into 3 distinct, actionable buckets:
     - `matched`: Keyword / skill is present in the resume. Includes exact vs synonym matching (`ts` <-> `typescript`, `k8s` <-> `kubernetes`, `postgres` <-> `postgresql`, etc.) and specifies the section/entry/excerpt in the resume where it is found.
     - `supportedMissing`: Keyword is missing from the tailored resume, but **supported by verified facts in the user's master profile**. Identifies the supporting section, evidence, profile revision, suggested target resume section, and an actionable suggestion to include it.
     - `unsupportedMissing`: Keyword is found neither in the resume nor in the master profile. Honest disclosure: `"Not found in this profile."` with advice to add it to the Master Profile under Skills or Experience first if the user possesses the qualification.
   - Strictly enforces invariant boundaries:
     - **Zero mutation**: Gap analysis is strictly read-only and causes zero mutation to the resume or master profile.
     - **Contact privacy**: `UserContact` facts (email, phone, address, portfolio URLs) are strictly excluded and never accessed or leaked.
     - **No hallucination**: Qualifications are never invented; unsupported requirements are never suggested for direct resume insertion without master profile confirmation.
   - Aggregate statistics returned: `matchPercentage`, `totalKeywordsCount`, `matchedCount`, `supportedMissingCount`, `unsupportedMissingCount`, `requiredMissingCount`.

2. **JD History Deletion (F11)**:
   - `DELETE /api/v1/jd/:id` and `DELETE /api/v1/jd/history/:id`: Scoped to the authenticated actor's workspace and profile (`createdByUserId = actor.userId`, `workspaceId = personalWorkspaceId`).
   - Transactional reference nullification: Because `Resume.jdHistoryId` has an `onDelete: Restrict` foreign key constraint referencing `JDHistory(id)`, all user resumes referencing this JD are updated with `jdHistoryId: null` within the same database transaction.
   - Deletes the `JDHistory` database record and writes an atomic audit outbox event with `action: "resume.deleted"` and `reasonCode: "jd_deleted"`.
   - Multi-tenant isolation: Foreign actors receive `404 not_found` when attempting to delete another user's JD.

3. **Multi-Resume Isolation & Resume Feature Assurance**:
   - Confirmed and verified across test suites: When a user possesses multiple resumes (e.g. Resume 1, Resume 2, Resume 3), updating Resume 1 increments only Resume 1's version, leaving Resume 2 and Resume 3 completely untouched.
   - Upload/import (`POST /api/v1/resume/import`), download (`GET /api/v1/resume/:id/download`), tailoring (`POST /api/v1/resume/:id/tailor`), suggestions (`POST /api/v1/resume/:id/suggest`), and suggestion application (`POST /api/v1/resume/:id/apply-suggestion`) operate independently per resume ID.

---

## 2. Files Modified & Created

- `services/resume-service/src/gap-contracts.ts` (created) — Zod schemas and DTO contracts for gap analysis requests, matched items, supported missing items, unsupported missing items, and aggregate result envelopes.
- `services/resume-service/src/gap-analyzer.ts` (created) — Core heuristic and synonym-aware gap analysis engine with master profile grounding, contact privacy isolation, and zero-mutation guarantees.
- `services/resume-service/src/resume.ts` (modified) — Implemented `deleteJDHistory` (with transactional FK nullification) and `analyzeResumeGap` (grounded profile query and analyzer dispatch).
- `services/resume-service/src/app.ts` (modified) — Registered CORS and Hono route handlers for `DELETE /api/v1/jd/:id`, `DELETE /api/v1/jd/history/:id`, `POST /api/v1/resume/:id/gap-analysis`, and `GET /api/v1/resume/:id/gap-analysis`.
- `services/resume-service/package.json` (modified) — Registered `test/gap-analyzer.test.mjs` in `test` and `test/gap-analysis.db.test.mjs` in `test:db`.
- `services/resume-service/test/gap-analyzer.test.mjs` (created) — 3 unit tests covering classification, synonym matching, and non-mutation/privacy invariants.
- `services/resume-service/test/route.test.mjs` (modified) — 6 new unit tests for JD delete and gap analysis route dispatch.
- `services/resume-service/test/gap-analysis.db.test.mjs` (created) — 9 end-to-end integration tests using real PostgreSQL 18.3 verifying gap analysis, JD history deletion, FK reference nullification, multi-resume isolation, and foreign actor denial.
- `docs/handoffs/backend-gap-analysis.md` (created) — This document.

---

## 3. API Contract Specifications

### `POST /api/v1/resume/:id/gap-analysis`
- **Method**: `POST`
- **Auth**: `Bearer <token>` (`skillgap.analyze`)
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "jdHistoryId": "b6a8270b-689e-47f3-8f0a-115f5d812457",
    "rawJD": "Optional raw JD text if analyzing on-the-fly"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "resumeId": "c62b489d-7db4-464a-bc12-68df6d0d2493",
      "resumeTitle": "Target Backend Resume",
      "resumeVersion": 1,
      "profileRevision": 5,
      "jdHistoryId": "b6a8270b-689e-47f3-8f0a-115f5d812457",
      "jobTitle": "Lead Distributed Systems Architect",
      "company": "ScaleGrid Corp",
      "matchPercentage": 75,
      "totalKeywordsCount": 4,
      "matchedCount": 2,
      "supportedMissingCount": 1,
      "unsupportedMissingCount": 1,
      "requiredMissingCount": 1,
      "matched": [
        {
          "keyword": "TypeScript",
          "category": "technical",
          "required": true,
          "matchType": "exact",
          "matchedText": "TypeScript",
          "resumeSection": "skills",
          "explanation": "Matches 'TypeScript' found in resume skills."
        }
      ],
      "supportedMissing": [
        {
          "keyword": "Kubernetes",
          "category": "tools",
          "required": true,
          "supportingSourceSection": "experience",
          "supportingEvidence": "Maintained production Kubernetes clusters (k8s) across 3 AWS regions.",
          "profileRevision": 5,
          "suggestedTargetSection": "experience",
          "suggestedAction": "Add the bullet point regarding 'Kubernetes' from CloudTech to this resume.",
          "explanation": "Supported in master profile experience, but omitted from this resume."
        }
      ],
      "unsupportedMissing": [
        {
          "keyword": "Rust",
          "category": "technical",
          "required": false,
          "advice": "If you possess experience with 'Rust', add it to your Master Profile under Skills or Experience first.",
          "explanation": "Not found in this profile."
        }
      ],
      "model": "deterministic-hybrid-v1",
      "semanticEngineStatus": "fallback_exact_synonyms",
      "analyzedAt": "2026-10-04T18:20:00.000Z"
    },
    "requestId": "UUID"
  }
  ```

### `GET /api/v1/resume/:id/gap-analysis`
- **Method**: `GET`
- **Auth**: `Bearer <token>` (`skillgap.analyze`)
- **Behavior**: Automatically resolves the resume's linked `jdHistoryId` and performs the gap analysis. If no JD was linked, returns `422 invalid_input`.

### `DELETE /api/v1/jd/:id` (and alias `DELETE /api/v1/jd/history/:id`)
- **Method**: `DELETE`
- **Auth**: `Bearer <token>` (`resume.delete`)
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "deleted": true,
      "id": "b6a8270b-689e-47f3-8f0a-115f5d812457"
    },
    "requestId": "UUID"
  }
  ```

---

## 4. Verification Evidence

- `pnpm --filter @resume-forge/resume-service test`:
  - 49/49 unit tests passing (extractor, parser, route, jd-parser, generator, gap-analyzer).
- `pnpm --filter @resume-forge/resume-service test:db`:
  - 35/35 integration tests passing across all 4 database test suites (`resume.test.mjs`, `jd.test.mjs`, `generator.db.test.mjs`, `gap-analysis.db.test.mjs`) against local PostgreSQL 18.3.
- `pnpm typecheck`:
  - 19/19 monorepo workspace packages passing clean (zero errors).
- `pnpm --filter @resume-forge/resume-service lint`:
  - Clean (zero errors, zero warnings).
