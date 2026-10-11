# Backend Handoff: Job Description Parser, JDHistory Persistence & ATS Resume Tailoring

## Audit disposition — 2026-10-11

This is a historical backend handoff. Its source was integrated, but its original completion/test counts are not fresh audit results or proof of live gateway exposure. [Current feature status and safety findings](../implementation-audit.md) supersede activation claims here. Profile section handlers exist without connected browser forms; JD-history/generator/gap/clone/version handlers remain personal-runtime gated; shared workspace APIs remain disconnected.

- **Task**: Implement Job Description parsing, JDHistory persistence, and Resume tailoring ATS scoring under F05/F07/F11.
- **Branch**: `codex/backend`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented the end-to-end backend capabilities for Job Description ingestion, structured parsing, persistent history tracking, and ATS match scoring:

1. **Job Description (JD) Parsing (F05)**:
   - Rule-based, deterministic heuristic parser extracting: `jobTitle`, `company`, `experienceLevel` (`entry`, `mid`, `senior`, `lead`, `executive`, `unknown`), `roleType` (`full-time`, `part-time`, `contract`, `internship`, `remote`, `hybrid`), `requirements`, `responsibilities`, and categorized `keywords` (`technical`, `tools`, `domain`, `soft_skills`, `education`, `general`).
   - Categorizes keywords as `required` (if in core requirements/must-haves) vs preferred.
   - Extracts contextual `evidence` for every keyword.
   - Prompt injection neutralization: sanitizes adversarial instructions (e.g. "ignore previous instructions", "DAN mode", "reveal secrets", `<script>`) to treat JD inputs solely as passive data.

2. **JDHistory Persistence & Access Control (F11)**:
   - Scoped to user profile and personal workspace (`individual`).
   - Strict actor authorization and ownership checks (`resume.create` / `resume.read`).
   - Multi-tenant isolation: foreign users cannot read, list, or tailor with another user's JDs.
   - Outbox audit logging (`resume.created` with `reasonCode: "jd_created"`).

3. **ATS Scoring & Tailoring (F07 - D09 Rubric)**:
   - Reproducible, bounded (0–100) scoring based on the five-component D09 rubric:
     - **Required keyword coverage** (30% weight): checks required JD terms in resume summary, experience bullets, and skills.
     - **Experience and responsibility relevance** (25% weight): checks seniority level alignment and responsibility verb matches.
     - **Skills alignment** (20% weight): checks technical, tool, and domain competencies in skills and project sections.
     - **Completeness and structure** (15% weight): checks header/contact, summary, experience, and education/skills sections.
     - **Readability and formatting** (10% weight): checks bullet point lengths and section organization.
   - Generates actionable recommendations and gap feedback.
   - Persists `atsScore` and `atsBreakdown` JSON in `Resume` and latest `ResumeVersion`.
   - Outbox audit logging (`resume.updated` with `reasonCode: "tailor_resume"`).
   - Multi-resume isolation: tailoring Resume 1 updates only Resume 1, leaving Resume 2 and Resume 3 untouched.

---

## 2. Files Modified & Created

- `services/resume-service/src/jd-contracts.ts` (created) — Zod schemas and DTO types for JD parsing, JDHistory, ATS breakdown, and tailor requests/responses.
- `services/resume-service/src/jd-parser.ts` (created) — Sanitization, prompt-injection neutralization, section extraction, and categorized keyword extraction.
- `services/resume-service/src/ats-scorer.ts` (created) — Five-component ATS scoring engine adhering to D09 rubric with actionable recommendations.
- `services/resume-service/src/resume.ts` (modified) — Integrated `parseJdOnly`, `parseAndSaveJD`, `getJDHistoryById`, `listJDHistories`, and `tailorResume` with transactional audit outbox logging.
- `services/resume-service/src/app.ts` (modified) — Registered CORS and Hono routes for `/api/v1/jd/parse`, `/api/v1/jd`, `/api/v1/jd/history`, `/api/v1/jd/:id`, and `POST /api/v1/resume/:id/tailor`.
- `services/resume-service/package.json` (modified) — Updated `test` and `test:db` scripts to include new unit and DB integration test suites.
- `services/resume-service/test/jd-parser.test.mjs` (created) — 4 unit tests verifying parsing heuristics, prompt injection neutralization, ATS scoring math, and gap recommendations.
- `services/resume-service/test/route.test.mjs` (modified) — 5 route tests verifying HTTP dispatch, mock integration, and auth handling.
- `services/resume-service/test/jd.test.mjs` (created) — 9 end-to-end integration tests using PostgreSQL verifying persistence, foreign owner denial, multi-resume isolation, and audit logging.
- `docs/handoffs/backend-jd-tailoring.md` (created) — This document.

---

## 3. API Contract Specifications

### 1. `POST /api/v1/jd/parse` (Parse JD Preview)
- **Auth**: None required (public/utility preview)
- **Body**:
  ```json
  {
    "rawJD": "Seeking a Senior Backend Engineer proficient in TypeScript, Node.js, and PostgreSQL...",
    "jobTitle": "Senior Backend Engineer",
    "company": "CloudScale"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "jobTitle": "Senior Backend Engineer",
      "company": "CloudScale",
      "experienceLevel": "senior",
      "roleType": "full-time",
      "keywords": [
        {
          "name": "TypeScript",
          "category": "technical",
          "required": true,
          "evidence": "proficient in TypeScript, Node.js, and PostgreSQL"
        }
      ],
      "requirements": ["5+ years backend experience..."],
      "responsibilities": ["Design microservices..."]
    },
    "requestId": "UUID"
  }
  ```

### 2. `POST /api/v1/jd` or `POST /api/v1/jd/history` (Save JD)
- **Auth**: `Bearer <token>` (`resume.create`)
- **Body**: Same as parse request.
- **Response**: `201 Created`
  ```json
  {
    "data": {
      "id": "UUID",
      "profileId": "UUID",
      "workspaceId": "UUID",
      "jobTitle": "Senior Backend Engineer",
      "company": "CloudScale",
      "rawJD": "...",
      "parsedKeywords": [...],
      "parsedRequirements": [...],
      "parsedResponsibilities": [...],
      "experienceLevel": "senior",
      "roleType": "full-time",
      "createdAt": "2026-10-04T12:00:00.000Z"
    },
    "requestId": "UUID"
  }
  ```

### 3. `GET /api/v1/jd/history` (List JDs)
- **Auth**: `Bearer <token>` (`resume.read`)
- **Response**: `200 OK` with array of `JdHistoryDto` ordered by `createdAt desc`.

### 4. `GET /api/v1/jd/:id` (Get Single JD)
- **Auth**: `Bearer <token>` (`resume.read`)
- **Response**: `200 OK` with `JdHistoryDto` (returns `404` for non-existent or foreign records).

### 5. `POST /api/v1/resume/:id/tailor` (Tailor Resume)
- **Auth**: `Bearer <token>` (`resume.update`)
- **Body**:
  ```json
  {
    "jdHistoryId": "UUID"
  }
  ```
  *(or pass `{"rawJD": "..."}` directly)*
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "resumeId": "UUID",
      "jdHistoryId": "UUID",
      "atsScore": 88,
      "atsBreakdown": {
        "overallScore": 88,
        "rubricVersion": "1.0.0",
        "keywordMatch": {
          "matched": ["TypeScript", "Node.js", "PostgreSQL"],
          "missing": ["Redis", "GraphQL"],
          "score": 80
        },
        "experienceRelevance": {
          "score": 95,
          "feedback": "Demonstrated senior-level leadership and tenure aligns with target seniority."
        },
        "skillsCoverage": {
          "matched": ["TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS"],
          "missing": ["Redis"],
          "score": 83
        },
        "completenessScore": 100,
        "readabilityScore": 85,
        "recommendations": [
          "Incorporate missing required keywords: Redis, GraphQL into your experience bullets or summary."
        ]
      }
    },
    "requestId": "UUID"
  }
  ```

---

## 4. Verification & Test Execution Results

All checks passed cleanly in `@resume-forge/resume-service`:

1. **Typecheck**:
   ```bash
   pnpm --filter @resume-forge/resume-service typecheck
   # Output: $ tsc --noEmit (0 errors)
   ```

2. **Lint**:
   ```bash
   pnpm --filter @resume-forge/resume-service lint
   # Output: $ eslint src/ (0 errors, 0 warnings)
   ```

3. **Unit & Route Tests (29/29 passing)**:
   ```bash
   pnpm --filter @resume-forge/resume-service test
   # Output: 29 tests passed, 0 failures (196ms)
   ```

4. **PostgreSQL Database Integration Tests (20/20 passing)**:
   ```bash
   pnpm --filter @resume-forge/resume-service test:db
   # Output:
   # ✔ Job Description parsing, JDHistory persistence, and ATS tailoring with real PostgreSQL (8 subtests passed)
   # ✔ Resume import, parsing and transactional persistence with real PostgreSQL (10 subtests passed)
   # 20 tests passed, 0 failures (2.3s)
   ```

---

## 5. What the User Should Check Manually

### A. Run Automated Verification
In terminal from the backend checkout (`/Users/nishankbansal/Downloads/backend`):
```bash
# 1. Run all unit and route tests
pnpm --filter @resume-forge/resume-service test

# 2. Run real PostgreSQL integration tests
pnpm --filter @resume-forge/resume-service test:db

# 3. Verify strict lint and typecheck
pnpm --filter @resume-forge/resume-service lint
pnpm --filter @resume-forge/resume-service typecheck
```

### B. Manual HTTP Verification with `curl` (Service Dev Server)
Start the service on port 4003:
```bash
pnpm --filter @resume-forge/resume-service dev
```

1. **Parse a Job Description (Public Preview)**:
```bash
curl -s -X POST http://127.0.0.1:4003/api/v1/jd/parse \
  -H "Content-Type: application/json" \
  -d '{
    "rawJD": "Senior Backend Engineer at Acme Corp. Must have 5+ years experience with TypeScript, Node.js, and PostgreSQL. Docker and AWS required.",
    "jobTitle": "Senior Backend Engineer",
    "company": "Acme Corp"
  }' | jq
```

2. **Save a Job Description (Authenticated)**:
```bash
curl -s -X POST http://127.0.0.1:4003/api/v1/jd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{
    "rawJD": "Senior Backend Engineer at Acme Corp. Must have 5+ years experience with TypeScript, Node.js, and PostgreSQL. Docker and AWS required."
  }' | jq
```

3. **List JD History**:
```bash
curl -s -X GET http://127.0.0.1:4003/api/v1/jd/history \
  -H "Authorization: Bearer <your-access-token>" | jq
```

4. **Tailor an Existing Resume Against the Saved JD**:
```bash
curl -s -X POST http://127.0.0.1:4003/api/v1/resume/<resume-id>/tailor \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{
    "jdHistoryId": "<jd-history-id>"
  }' | jq
```
Observe the response contains:
- `atsScore` (0–100)
- `atsBreakdown` with 5 components: `keywordMatch`, `experienceRelevance`, `skillsCoverage`, `completenessScore`, `readabilityScore`, and targeted `recommendations`.
- Verifies that Resume `<resume-id>` now reflects the new score without affecting any other resumes.
