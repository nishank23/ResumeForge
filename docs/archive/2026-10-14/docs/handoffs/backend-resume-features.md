> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Backend Handoff: Resume Editing, Versioning, Download and Multi-Resume Isolation

## Audit disposition — 2026-10-11

This is a historical backend handoff. Its source was integrated, but its original completion/test counts are not fresh audit results or proof of live gateway exposure. [Current feature status and safety findings](../implementation-audit.md) supersede activation claims here. Profile section handlers exist without connected browser forms; JD-history/generator/gap/clone/version handlers remain personal-runtime gated; shared workspace APIs remain disconnected.

- **Task**: Implement resume updating, optimistic concurrency, version history, format downloads (JSON, Markdown, Plaintext, HTML), cloning, deletion, and strict multi-resume isolation.
- **Branch**: `codex/backend`
- **Date**: 2026-10-04
- **Active Task Lock**: `ef95df0e-9da6-4035-b399-5b6c9bdd7002`

---

## 1. Overview & Summary of Changes

Extended `@resume-forge/resume-service` under `services/resume-service` to provide full lifecycle management for resumes with strict row-level and multi-resume isolation:

1. **Multi-Resume Isolation**:
   - Guaranteed strict isolation across a user's multiple resumes: If a user has 3 resumes (Resume 1, Resume 2, Resume 3) and edits Resume 1, **only Resume 1 is updated**. Resumes 2 and 3 remain untouched with their original versions, contents, and timestamps intact.
   - Tested and verified at the database level with real PostgreSQL assertions.

2. **Resume Update with Optimistic Concurrency**:
   - `PUT /api/v1/resume/:id`: Accepts `expectedVersion` and updated structured `content`.
   - Compares `existing.currentVersion === expectedVersion`. If stale, rejects immediately with HTTP 409 Conflict (`code: "revision_conflict"`).
   - On success, atomically creates a new `ResumeVersion` record (`versionNumber = currentVersion + 1`), updates the `Resume` record (`currentVersion = newVersionNumber`), and writes an atomic audit event (`resume.updated`, metadata `{ versionId, status }`).

3. **Multi-Format Resume Download & Export**:
   - `GET /api/v1/resume/:id/download?format=markdown|json|text|html`:
     - `markdown`: Structured markdown with bold headers, formatted contact links, work experience, education, projects, skills, and bullet points.
     - `json`: Formatted JSON of the structured resume content.
     - `text`: Clean plaintext representation.
     - `html`: Standalone semantic HTML page with `@media print` CSS optimized for browser printing and saving to PDF.
   - Returns appropriate `Content-Type` with `charset=utf-8` and `Content-Disposition: attachment; filename="<Title>.<ext>"`.
   - Records an atomic audit event (`resume.downloaded`, metadata `{ status: "succeeded" }`).

4. **Version History & Inspection**:
   - `GET /api/v1/resume/:id/versions`: Returns all historical versions of a resume ordered descending by `versionNumber`, showing full snapshot state at each revision.

5. **Resume Cloning**:
   - `POST /api/v1/resume/:id/clone`: Clones an existing resume into a distinct new draft resume record with version 1, deep copying all content and sections while generating new independent entity IDs.

6. **Resume Deletion**:
   - `DELETE /api/v1/resume/:id`: Atomically removes all associated `ResumeVersion` and `TaskRun` records and deletes the `Resume` record.
   - Records an atomic audit event (`resume.deleted`).
   - Cross-user deletion attempts return 404 (preventing existence disclosure).

---

## 2. API Contract Specification

### `PUT /api/v1/resume/:id`
- **Permission**: `resume.update`
- **Request Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "expectedVersion": 1,
    "title": "Principal Architect Resume",
    "templateId": "modern-tech",
    "status": "draft",
    "content": {
      "title": "Principal Architect Resume",
      "header": {
        "fullName": "Alice Engineer",
        "email": "alice@example.com",
        "headline": "Principal Architect"
      },
      "sampleContact": { "email": "", "phone": "" },
      "sections": [ ... ]
    }
  }
  ```
- **Responses**:
  - `200 OK`: Updated `ResumeDetailDto` with `currentVersion: 2`.
  - `409 Conflict`: If `expectedVersion !== currentVersion` (`code: "revision_conflict"`).
  - `404 Not Found`: If resume does not exist or belongs to another user.
  - `422 Unprocessable`: If body fails schema validation.

### `GET /api/v1/resume/:id/download`
- **Permission**: `resume.read`
- **Query Parameters**:
  - `format`: `markdown` | `json` | `text` | `html` (defaults to `markdown`)
- **Headers**:
  - `Authorization: Bearer <token>`
- **Response**:
  - `200 OK`
  - Headers:
    - `Content-Type`: `text/markdown; charset=utf-8` (or corresponding MIME type)
    - `Content-Disposition`: `attachment; filename="Alice_Resume.md"`

### `GET /api/v1/resume/:id/versions`
- **Permission**: `resume.read`
- **Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "UUID",
        "resumeId": "UUID",
        "versionNumber": 2,
        "content": { ... },
        "createdAt": "2026-10-04T12:00:00.000Z",
        "createdByUserId": "UUID"
      },
      {
        "id": "UUID",
        "resumeId": "UUID",
        "versionNumber": 1,
        "content": { ... },
        "createdAt": "2026-10-04T11:00:00.000Z",
        "createdByUserId": "UUID"
      }
    ],
    "requestId": "UUID"
  }
  ```

### `POST /api/v1/resume/:id/clone`
- **Permission**: `resume.create`
- **Request Body**:
  ```json
  {
    "title": "Alice Tailored for Staff Role"
  }
  ```
- **Response**: `201 Created` with new resume details (`currentVersion: 1`).

### `DELETE /api/v1/resume/:id`
- **Permission**: `resume.delete`
- **Response**: `200 OK` `{ "data": { "deleted": true, "id": "UUID" } }`.

---

## 3. Automated Test Verification Results

All tests run and pass cleanly:

1. **Unit & Route Tests** (`test/extractor.test.mjs`, `test/parser.test.mjs`, `test/route.test.mjs`):
   ```
   ✔ text extractor extracts and sanitizes plain text and markdown (0.78ms)
   ✔ text extractor parses PDF streams with FlateDecode and text operators (0.91ms)
   ✔ text extractor parses DOCX archives containing word/document.xml (0.53ms)
   ✔ text extractor rejects files exceeding 10MB limit (0.64ms)
   ✔ text extractor handles corrupt or invalid docx safely (0.17ms)
   ✔ heuristic parser extracts header, contacts, and links correctly (5.20ms)
   ✔ heuristic parser segments and structures all major resume sections (0.64ms)
   ✔ heuristic parser handles minimal resume without sections gracefully (0.21ms)
   ✔ heuristic parser handles comma-separated flat skills list (0.61ms)
   ✔ unauthenticated import requests return 401 with no-store (14.79ms)
   ✔ unsupported content-type returns 415 (0.87ms)
   ✔ POST /api/v1/resume/parse succeeds with valid JSON (0.83ms)
   ✔ POST /api/v1/resume/import succeeds with valid token and returns 201 (1.77ms)
   ✔ GET /api/v1/resume/:id returns resume details (0.89ms)
   ✔ GET /api/v1/resume lists user resumes (0.44ms)
   ✔ PUT /api/v1/resume/:id updates resume and returns 200 (0.81ms)
   ✔ DELETE /api/v1/resume/:id deletes resume and returns 200 (0.46ms)
   ✔ GET /api/v1/resume/:id/download returns formatted file with attachment header (1.17ms)
   ✔ GET /api/v1/resume/:id/versions returns version history (0.74ms)
   ✔ POST /api/v1/resume/:id/clone clones resume and returns 201 (0.52ms)
   ℹ pass 20 / fail 0
   ```

2. **Real PostgreSQL Integration Tests** (`test/resume.test.mjs`):
   ```
   ▶ Resume import, parsing and transactional persistence with real PostgreSQL
     ✔ imports and persists a PDF resume with transactional audit (41.73ms)
     ✔ imports and persists a DOCX resume (13.51ms)
     ✔ fetches persisted resume by ID for the owner (7.78ms)
     ✔ lists all resumes for the authenticated user (5.49ms)
     ✔ cross-user isolation: foreign user receives 404 (3.53ms)
     ✔ multi-resume isolation: updating Resume 1 leaves Resume 2 and Resume 3 untouched (45.01ms)
     ✔ lists version history for a resume in descending order (2.89ms)
     ✔ downloads resume in markdown, json, text and html formats with audit trail (27.54ms)
     ✔ clones an existing resume into a distinct draft copy (8.63ms)
     ✔ deletes resume with audit and verifies foreign user denial (21.58ms)
   ✔ Resume import, parsing and transactional persistence with real PostgreSQL (1979.64ms)
   ℹ pass 11 / fail 0
   ```

3. **Linter & Typechecker**:
   - `eslint src/`: 0 errors.
   - `tsc --noEmit`: 0 errors.

4. **Monorepo Profile Regressions** (`pnpm db:test:profile`):
   - 64/64 tests pass across Profile, Experience, and Education test suites.

---

## 4. Manual Verification Steps for the User

You can manually verify all features locally using `curl` against the resume microservice.

### Step 1: Start the service (if not running)
```bash
cd services/resume-service
pnpm dev
# Service starts on http://localhost:4003
```

### Step 2: Import Resume 1, Resume 2, and Resume 3
```bash
# 1. Create/import Resume 1
RES1=$(curl -s -X POST http://localhost:4003/api/v1/resume/import \
  -H "Authorization: Bearer <your-user-token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Resume 1 - Backend Specialist","fileName":"resume1.txt","mimeType":"text/plain","rawText":"John Doe\nSenior Backend Engineer\njohn@example.com\n\nExperience\nStaff Engineer at CloudCorp\n2020 - Present\nBuilt distributed systems."}')
RES1_ID=$(echo $RES1 | jq -r '.data.id')
echo "Resume 1 ID: $RES1_ID"

# 2. Create/import Resume 2
RES2=$(curl -s -X POST http://localhost:4003/api/v1/resume/import \
  -H "Authorization: Bearer <your-user-token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Resume 2 - DevOps Specialist","fileName":"resume2.txt","mimeType":"text/plain","rawText":"John Doe\nDevOps Engineer\njohn@example.com\n\nExperience\nSRE at CloudCorp\n2021 - Present\nKubernetes and Terraform."}')
RES2_ID=$(echo $RES2 | jq -r '.data.id')
echo "Resume 2 ID: $RES2_ID"

# 3. Create/import Resume 3
RES3=$(curl -s -X POST http://localhost:4003/api/v1/resume/import \
  -H "Authorization: Bearer <your-user-token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Resume 3 - Executive","fileName":"resume3.txt","mimeType":"text/plain","rawText":"John Doe\nEngineering Manager\njohn@example.com\n\nExperience\nEM at Enterprise Inc\n2019 - Present\nLed team of 15 engineers."}')
RES3_ID=$(echo $RES3 | jq -r '.data.id')
echo "Resume 3 ID: $RES3_ID"
```

### Step 3: Verify Multi-Resume Isolation (Update Resume 1)
```bash
# Fetch Resume 1 content
CONTENT=$(curl -s -H "Authorization: Bearer <your-user-token>" http://localhost:4003/api/v1/resume/$RES1_ID | jq '.data.content')

# Update ONLY Resume 1
curl -s -X PUT http://localhost:4003/api/v1/resume/$RES1_ID \
  -H "Authorization: Bearer <your-user-token>" \
  -H "Content-Type: application/json" \
  -d "{\"expectedVersion\": 1, \"title\": \"Resume 1 - Principal Architect\", \"content\": $CONTENT}" | jq .

# Verify Resume 1 version is now 2:
curl -s -H "Authorization: Bearer <your-user-token>" http://localhost:4003/api/v1/resume/$RES1_ID | jq '{title: .data.title, currentVersion: .data.currentVersion}'

# Verify Resume 2 STILL has currentVersion 1 and title "Resume 2 - DevOps Specialist":
curl -s -H "Authorization: Bearer <your-user-token>" http://localhost:4003/api/v1/resume/$RES2_ID | jq '{title: .data.title, currentVersion: .data.currentVersion}'

# Verify Resume 3 STILL has currentVersion 1 and title "Resume 3 - Executive":
curl -s -H "Authorization: Bearer <your-user-token>" http://localhost:4003/api/v1/resume/$RES3_ID | jq '{title: .data.title, currentVersion: .data.currentVersion}'
```

### Step 4: Verify Optimistic Concurrency Conflict
```bash
# Attempt to update Resume 1 with stale expectedVersion 1 (current is 2)
curl -s -X PUT http://localhost:4003/api/v1/resume/$RES1_ID \
  -H "Authorization: Bearer <your-user-token>" \
  -H "Content-Type: application/json" \
  -d "{\"expectedVersion\": 1, \"title\": \"Stale Update\", \"content\": $CONTENT}" | jq .
# Expected output: HTTP 409 Conflict with error code "revision_conflict"
```

### Step 5: Verify Resume Download in Multiple Formats
```bash
# Download as Markdown
curl -s -H "Authorization: Bearer <your-user-token>" "http://localhost:4003/api/v1/resume/$RES1_ID/download?format=markdown"

# Download as Plaintext
curl -s -H "Authorization: Bearer <your-user-token>" "http://localhost:4003/api/v1/resume/$RES1_ID/download?format=text"

# Download as HTML
curl -s -H "Authorization: Bearer <your-user-token>" "http://localhost:4003/api/v1/resume/$RES1_ID/download?format=html"

# Download as JSON
curl -s -H "Authorization: Bearer <your-user-token>" "http://localhost:4003/api/v1/resume/$RES1_ID/download?format=json" | jq .
```

### Step 6: Verify Version History
```bash
curl -s -H "Authorization: Bearer <your-user-token>" http://localhost:4003/api/v1/resume/$RES1_ID/versions | jq .
# Returns an array with Version 2 and Version 1
```

### Step 7: Clone Resume
```bash
curl -s -X POST http://localhost:4003/api/v1/resume/$RES1_ID/clone \
  -H "Authorization: Bearer <your-user-token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Cloned Architect Resume"}' | jq .
```

### Step 8: Delete Resume & Verify Isolation
```bash
# Delete Resume 1
curl -s -X DELETE http://localhost:4003/api/v1/resume/$RES1_ID \
  -H "Authorization: Bearer <your-user-token>" | jq .

# Verify Resume 1 is gone (404)
curl -s -H "Authorization: Bearer <your-user-token>" http://localhost:4003/api/v1/resume/$RES1_ID | jq .

# Verify Resume 2 and Resume 3 are still intact (200 OK)
curl -s -H "Authorization: Bearer <your-user-token>" http://localhost:4003/api/v1/resume/$RES2_ID | jq '{title: .data.title}'
curl -s -H "Authorization: Bearer <your-user-token>" http://localhost:4003/api/v1/resume/$RES3_ID | jq '{title: .data.title}'
```
