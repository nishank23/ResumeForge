# Frontend API integration readiness — 2026-10-04

## Recommendation

Start connecting the existing personal profile APIs after repairing the merged runtime baseline. Do not expand the business API surface first. The next useful outcome is an authenticated user saving professional details, reloading them, and handling revision conflicts in the browser. Keep the current resume editor and its temporary AI preview until their persistence and suggestion contracts pass integration checks.

## Repository state and evidence

`codex/frontend` was fast-forwarded from `4229630` to remote `main` at `9e6157b`. GitHub PRs #1 and #2 are merged. The update brings 15 commits and 66 changed files, including profile sections/contacts/completion, resume persistence/import/generation/suggestions/JD analysis, and shared-workspace APIs. No changes were made in the backend checkout.

This assessment used the merged route handlers, request schemas, startup configuration, frontend models and backend handoffs. Handoff test counts are reported evidence, not fresh verification here. Frontend implementation/shared UI are unchanged from the previously verified 40 frontend tests and four builds. Backend database suites and authenticated browser flows were not rerun.

## What can be integrated in order

| Area | Merged server surface | Frontend status and next action |
| --- | --- | --- |
| Personal professional profile | GET/POST/PUT `/api/v1/profile`, PUT `/profile/draft`; CRUD for Experience, Education, Skills, Projects and Certifications; POST `/profile/complete` | Profile remote is synthetic; onboarding remains a pending entry. First connect professional create/load/save/draft and verify reload, expiry and 409 conflict handling. Then add section forms and completion. |
| Contacts | GET/PUT `/api/v1/profile/contact` | Keep separate from professional writes. Review dedicated contact permissions before connecting real contact fields. |
| Resume persistence | GET/list/import/generate, PUT, versions, clone/delete and JSON/text/Markdown/HTML download | Current editor uses a local rich-text draft. Agree and prove a lossless mapping before replacing Save locally. Keep rich text, dates, section/item IDs, language proficiency, visibility and appearance across save/reload. Binary PDF export is not supplied by these download formats. |
| JD, ATS and gap analysis | JD parse/history/delete, resume tailoring and gap-analysis endpoints | Implement after profile and durable resume flows pass. Treat current algorithms as deterministic heuristics; provider-backed AI and approved scoring requirements remain separate. |
| AI review and shared workspaces | Suggest/apply/task retrieval and organization/vendor/member/grant/audit routes | Hold frontend activation until the findings below and applicable policy/phase gates are resolved. Endpoint presence does not establish complete integration or privacy acceptance. |

## Blocking findings

1. **Frozen installation fails.** `pnpm install --frozen-lockfile` reports `ERR_PNPM_PACKAGE_MANAGER_NO_IMPORTER`: the committed lockfile has no `services/resume-service` importer. Repair the lockfile and verify a clean frozen install before claiming reproducible backend checks. No lockfile regeneration was performed in this assessment.
2. **Startup configuration conflicts.** Resume configuration sets port 4003 (`services/resume-service/src/config.ts:34`), while the workspace entrypoint also defaults to 4003 (`services/workspace-service/src/index.ts:9`). Resume loads the original administrative `.local/database.env` rather than a distinct restricted runtime role, and its entrypoint omits the guarded role assertion. Workspace startup falls back to a literal PostgreSQL login and an all-zero internal auth key. Assign distinct ports, fail closed on missing credentials, and establish least-privilege runtime configuration before enabling these services. Do not reset shared credentials or create another database cluster as an incidental frontend setup step.
3. **The browser API path is incomplete.** The gateway still serves only health and a 404 fallback. New services allow the shell origin at port 3000, not the standalone resume remote at 3003. Resolve the browser-to-service routing/authentication path before wiring forms. A current anonymous runtime check found gateway health HTTP 200, but auth/profile/resume HTTP unavailable. The earlier auth/profile password failure remains recorded separately; credentials were not re-read or repaired here.
4. **Suggestion grounding fails.** The `quantify` action unconditionally adds a 35% latency improvement when it finds no metric (`services/resume-service/src/suggestion-engine.ts:69`). A dependency-free smoke probe transformed the synthetic input `Maintained service dashboards.` into a claim of reducing latency by 35%. This violates the no-invented-facts requirement. Other impact replacements can also introduce leadership/deployment claims; verify every action against supported facts before connecting Improve with AI.
5. **Apply differs from the reviewed-proposal contract.** `generator-contracts.ts:45` accepts arbitrary client `appliedContent` and an optional suggestion ID. `resume.ts:1421` applies that text without reloading the stored proposal; it only handles Summary and Experience although the schema also advertises Skills and Projects. Missing targets can still advance the version. Repair proposal identity/base-context binding, exact-target rejection, supported actions and replay behavior before enabling server-backed Accept. This is a source finding; no database mutation was executed to demonstrate it.
6. **Contact permission mapping needs correction/review.** `profile.ts:1128` authorizes contact reads with `profile.read`, and `profile.ts:1175` authorizes contact writes with `profile.update`. The canonical contact permissions are separate. Current personal ownership limits do not prove the shared-workspace contact policy; verify that policy before wiring contact UI or shared access.
7. **Editor round trips are not yet lossless.** The browser draft has `SummaryDocument` content, language proficiency, precise date fields and appearance settings (`apps/resume-mfe/src/editor-draft.ts:35`). The backend's strict content schema models Summary as a string and omits top-level appearance and section language fields (`services/resume-service/src/contracts.ts:115`). A direct cast or request cannot establish preservation. Design an explicit adapter and, where required, compatible contract support; verify save/reload with synthetic rich-text and formatting fixtures.

## Bounded next slice

First repair reproducible installation, runtime ports/credentials and browser routing. Then connect personal professional profile create/read/update/draft through a typed client using the existing session and workspace selector. Verify loading, empty profile, validation, failed save, expired session, revision conflict and persistence after reload. Follow with section CRUD/completion, then resume list/load/save/version history after the lossless contract is ready. Keep AI, ATS/PDF claims and shared-workspace activation within their separately verified scope.

No new product code, dependencies, credentials, permissions, schema or data were changed by this assessment.
