> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Backend Handoff: Resume Import, Parsing and Database Persistence

## Audit disposition — 2026-10-11

This is a historical backend handoff. Its source was integrated, but its original completion/test counts are not fresh audit results or proof of live gateway exposure. [Current feature status and safety findings](../implementation-audit.md) supersede activation claims here. Profile section handlers exist without connected browser forms; JD-history/generator/gap/clone/version handlers remain personal-runtime gated; shared workspace APIs remain disconnected.

- **Task**: Implement local resume file intake, parsing (PDF, DOCX, TXT/MD/JSON), and database persistence under `Resume` and `ResumeVersion`, with transactional audit and cross-user isolation.
- **Branch**: `codex/backend`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented the new standalone microservice `@resume-forge/resume-service` under `services/resume-service`, satisfying the requirements for local resume file intake, text extraction, structured heuristic parsing, and PostgreSQL transactional persistence without requiring external AI API calls or cloud dependencies:

- **Local Multi-format Text Extraction** (`src/extractor.ts`):
  - In-memory binary parsing for PDF (`/FlateDecode` stream decompression using native `zlib.inflateSync`, regex extraction of PDF text operators `Tj` and `TJ`, font octal escapes, and parenthesis balancing).
  - Native PKZip archive parsing for DOCX (`word/document.xml` decompression via `deflateRawSync` / `inflateRawSync` with XML text node stripping).
  - Plaintext and markdown sanitization (stripping NULL bytes and normalizing CRLF/LF linebreaks).
  - Strict 10MB payload size limit and defensive handling of corrupt archives.

- **Heuristic Structured Resume Parser** (`src/parser.ts`):
  - Contact and header extraction: Name, email addresses, phone numbers, location (city/state), and profile URLs (LinkedIn, GitHub, portfolio).
  - Section segmentation: Heuristically identifies Work Experience, Education, Skills, Projects, and Professional Summary using case-insensitive anchor headings.
  - Date normalization: Extracts ISO YYYY, YYYY-MM, or Present ranges.
  - Bullet-point segmentation: Parses standard bullet markers (`•`, `-`, `*`) and numbered lists.
  - Skill classification: Groups technical and domain skills into categorized groups (Languages, Frameworks, Tools, etc.) or normalized flat skill lists.

- **Transactional Database Persistence** (`src/resume.ts`):
  - Persists structured resume into Prisma models `Resume` and `ResumeVersion` (`versionNumber: 1`, `status: "draft"`).
  - Ensures a baseline `UserProfile` exists for foreign key integrity without overwriting existing master profile facts.
  - Atomic audit logging with `withPersonalAuditTransaction` writing to `AuditOutbox` (`action: "resume.created"`, `resourceType: "resume"`, allowlisted metadata `{ versionId, status: "draft" }`).
  - Row-level access authorization (`authorizePersonalScope`) ensuring strict tenant isolation; cross-user requests receive 404/403.

- **HTTP Service & Endpoints** (`src/app.ts`, `src/index.ts`):
  - Hono-based microservice listening on port 4003 (with `@hono/node-server`).
  - JSON payload support (`fileBase64`, `rawText`) and multipart/form-data support.
  - Enforces `Cache-Control: no-store` and scoped CORS headers.

### Files Created

- `services/resume-service/package.json` — Package configuration with workspace dependencies.
- `services/resume-service/tsconfig.json` — TypeScript configuration.
- `services/resume-service/eslint.config.js` — ESLint flat config.
- `services/resume-service/src/contracts.ts` — Zod request/response contracts and DTO types.
- `services/resume-service/src/extractor.ts` — Zero-dependency PDF/DOCX/TXT text extractor.
- `services/resume-service/src/parser.ts` — Structured heuristic parser for sections and fields.
- `services/resume-service/src/resume.ts` — Business use cases with transactional audit.
- `services/resume-service/src/app.ts` — Hono HTTP application and routes.
- `services/resume-service/src/index.ts` — Service entrypoint.
- `services/resume-service/test/extractor.test.mjs` — Extractor unit tests.
- `services/resume-service/test/parser.test.mjs` — Parser unit tests.
- `services/resume-service/test/route.test.mjs` — HTTP route unit tests.
- `services/resume-service/test/resume.test.mjs` — Real PostgreSQL integration tests.
- `docs/handoffs/backend-resume-import.md` — This handoff document.

---

## 2. API Contract Specification

### `POST /api/v1/resume/parse`

- **Purpose**: Parse a resume file or text without persisting to database (e.g. client preview).
- **Headers**:
  - `Content-Type: application/json` or `multipart/form-data`
- **Request Body (JSON)**:
  ```json
  {
    "fileName": "resume.pdf",
    "mimeType": "application/pdf",
    "fileBase64": "<base64 encoded bytes>",
    "rawText": "optional plaintext fallback"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "title": "Extracted Title",
      "header": {
        "fullName": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+1 555-0199",
        "city": "San Francisco",
        "state": "CA",
        "links": ["https://linkedin.com/in/janedoe"]
      },
      "sections": [
        {
          "id": "UUID",
          "kind": "experience",
          "heading": "Experience",
          "entries": [ ... ]
        }
      ]
    },
    "requestId": "UUID"
  }
  ```

### `POST /api/v1/resume/import`

- **Permission**: `resume.create`
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json` or `multipart/form-data`
  - Optional `X-Workspace-Id: <workspaceId>`
- **Request Body (JSON)**:
  ```json
  {
    "fileName": "resume.docx",
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "fileBase64": "<base64 encoded bytes>",
    "title": "Custom Resume Title",
    "templateId": "classic"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "data": {
      "id": "UUID",
      "profileId": "UUID",
      "workspaceId": "UUID",
      "title": "Custom Resume Title",
      "templateId": "classic",
      "currentVersion": 1,
      "status": "draft",
      "atsScore": null,
      "content": { ... },
      "createdAt": "2026-10-04T13:00:00.000Z",
      "updatedAt": "2026-10-04T13:00:00.000Z"
    },
    "requestId": "UUID"
  }
  ```
- **Audit**: Action `resume.created`, resourceType `resume`, metadata `{ versionId: "UUID", status: "draft" }`.

### `GET /api/v1/resume/:id`

- **Permission**: `resume.read`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Response**: `200 OK` with full resume details and structured content.
- **Error Codes**: `404 not_found` if not found or owned by a different user.

### `GET /api/v1/resume`

- **Permission**: `resume.read`
- **Headers**:
  - `Authorization: Bearer <token>`
- **Response**: `200 OK` with list of resume summaries owned by the authenticated actor.

---

## 3. Verification & Test Results

### Test Suite Execution

1. **Unit & Route Tests** (`pnpm --filter @resume-forge/resume-service test`):
   - `test/extractor.test.mjs`: **5/5 PASS** (text extraction, PDF FlateDecode, DOCX archive XML, 10MB limits, corrupt files).
   - `test/parser.test.mjs`: **4/4 PASS** (header/contacts, full sections, flat skills, fallback for minimal text).
   - `test/route.test.mjs`: **6/6 PASS** (auth check 401, 415 content-type guard, parse 200, import 201, get 200, list 200).
   - Total: **15/15 PASS** in 105ms.

2. **Database Integration Tests** (`pnpm --filter @resume-forge/resume-service test:db`):
   - `test/resume.test.mjs`: **6/6 PASS** running against disposable PostgreSQL database `rf_resume_test_*`.
   - Scenarios tested:
     - PDF file import creates `Resume` + `ResumeVersion` rows and atomic `AuditOutbox` record.
     - DOCX file import parses and persists correctly.
     - `GET /api/v1/resume/:id` fetches persisted resume and structured version content.
     - `GET /api/v1/resume` lists resumes for the owner.
     - Cross-user tenant isolation: foreign user receives 404.

3. **Code Quality**:
   - `pnpm --filter @resume-forge/resume-service lint`: **0 errors**.
   - `pnpm --filter @resume-forge/resume-service typecheck`: **0 errors**.

4. **Monorepo Regressions Check**:
   - `pnpm db:test`: **14/14 PASS**.
   - `pnpm db:test:audit`: **12/12 PASS**.
   - `pnpm db:test:roles`: **12/12 PASS**.
   - `pnpm --filter @resume-forge/profile-service test`: **10/10 PASS**.
   - `pnpm --filter @resume-forge/auth-service test`: **5/5 PASS**.

---

## 4. Vector Database Status

- Local PostgreSQL 18.3 on `127.0.0.1:55432` has extension `vector 0.8.7` installed and verified.
- Vector database embeddings generation for AI tailoring is intentionally deferred to the AI tailoring / suggestion phase, matching the user instruction to complete local import, parsing, and database persistence first.

---

## 5. Manual Verification Steps

1. Verify PostgreSQL is running:
   ```bash
   node scripts/local-db.mjs status
   ```
2. Run automated resume service tests:
   ```bash
   pnpm --filter @resume-forge/resume-service test
   pnpm --filter @resume-forge/resume-service test:db
   ```
3. Test unauthenticated import rejection:
   ```bash
   curl -i http://127.0.0.1:4003/api/v1/resume/import
   # Expected: 401 Unauthorized with code "unauthenticated" and Cache-Control: no-store
   ```
4. Test unauthenticated parse (allowed for preview):
   ```bash
   curl -i -X POST http://127.0.0.1:4003/api/v1/resume/parse \
     -H 'Content-Type: application/json' \
     -d '{"rawText": "Jane Doe\njane@example.com\nSan Francisco, CA\n\nExperience\nSoftware Engineer - Acme Corp\n2020 - Present\n* Built distributed backend services."}'
   # Expected: 200 OK with structured JSON containing parsed header and experience section
   ```
