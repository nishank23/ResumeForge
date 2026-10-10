# Frontend API integration readiness — 2026-10-04

## Current Gemini and compact assessment update — 2026-10-09

The user now selects paid **gemini-3.5-flash-lite** for semantic JD evidence and selected wording, superseding earlier Gemini-analysis-only/MiMo-rewrite instructions. Server keys, explicit per-request consent, professional/contact-free scope, grounding, immutable-version review/Apply and private gemini-embedding-001/768 retrieval remain. ATS groups all checks into five expandable areas; JD editor/breakdown/evidence collapse after evaluation. Approved numeric rubrics stay deterministic. OpenCode SDK/native/HTTP and unused Textkernel runtime/tests are removed; legacy stored proposals/public result schemas remain readable. [Current configuration, API behavior and limits](ats-workflow.md).


## JD and scoped AI connected — 2026-10-09

The personal editor now connects version-bound JD run/read/preferences and scoped rewrite request/apply endpoints. JD input/result persistence, staleness, exact-entry Fix, description review, provider consent and immutable scoped apply are implemented. Local and paid Gemini analysis passed browser verification; genuine version-matched OpenCode SDK generation was retested after `/connect` and remains blocked by 403 FreeTierError. Apply persistence passed synthetic mocked-provider database testing. Earlier statements that JD/AI are wholly disconnected are historical. Shared activation, broad scoring validation and durable jobs remain pending. [Current API and manual checks](ats-workflow.md).

## Private vector evidence connected — 2026-10-09

Gemini consent discloses professional-text embedding storage. Saved JD results show indexed/reused entry and candidate counts; similarity is not proof of a matching qualification. Real sample import, supplied JD analysis (36/100, 5 entries, 12 candidates), reload and saved PDF download passed. [Scope/setup/manual checks](resume-vector-search.md).

## General readiness connected — 2026-10-09

The personal editor now connects GET/POST `/api/v1/resume/:id/readiness` and PUT `/:id/readiness/preferences` through the authenticated gateway. Results score the latest saved immutable version using the approved no-JD `readiness-v1` rubric. Opening the saved editor selects ATS Score and automatically evaluates missing/outdated evidence. Saving invalidates freshness and triggers a check; failure retains stale evidence and offers Retry. Local edit previews use the same pure scorer/projection without an API write, and manual Fix dialogs include issue guidance and field focus. Completed lists every passing check. Persisted dismissal/restore and reload are supported. No new runtime grant/schema/provider is required. This supersedes earlier statements that all ATS-related presentation is disconnected; JD matching, AI, shared roles and durable scoring jobs remain pending. [Manual checks and precise limits](../README.md#general-resume-readiness--2026-10-09).

## Current recommendation

The requested personal resume integration is now connected: no profile setup gate, owned library, blank creation, authenticated file review and immutable version saves. Use the [README manual checks](../README.md#resume-library-upload-and-database-saves--2026-10-04) before adding another slice. Reproducible installation, fixed gateway routing, a strict lossless editor mapping and an approved restricted resume runtime role resolve the corresponding historical blockers below for this personal flow. Workspace business service remains stopped; its separate startup conflicts are not resolved globally.

Next useful work is resolving selected MiMo provider access and evaluating scoring quality, then durable retrieval/indexing or remaining resume management. Grounding and persisted suggestion binding are implemented; successful live rewriting remains blocked. Personal owner PDF downloads and confirmed recoverable deletion are connected as of 2026-10-08. JD-specific scoring, shared activation and the full durable PDF pipeline still need their own policy and integration acceptance. Existing endpoints alone do not justify more API surface.

Search/sort cover loaded 50-row pages, not global server search. File review is local PDF/DOCX/TXT/MD with limits; full F19 private staging/provenance/OCR remains pending. Private owner-only resume header snapshots are stored without writing UserContact or master professional fields; D12 permits current-version personal owner PDF streams; shared/contact-free variants remain unresolved. LinkedIn needs credentials.

## Saved resume management — 2026-10-08

Connected DELETE `/api/v1/resume/:id` with `{ expectedVersion }`, POST `/:id/restore` with the same version guard, and GET `/:id/pdf?version=N`. Deletion is a retained tombstone; PDF uses the latest immutable saved editor version. No database grants were expanded. The browser must confirm a reviewed upload/save before downloading. [Current manual checks and limits](../README.md#delete-resumes-and-download-saved-pdfs--2026-10-08).

## Historical baseline assessment

The following repository findings describe the pre-integration baseline. Current scope/evidence is above and in the canonical tracker; resolved findings are retained to explain why activation was bounded.

## Repository state and evidence

`codex/frontend` was fast-forwarded from `4229630` to remote `main` at `9e6157b`. GitHub PRs #1 and #2 are merged. The update brings 15 commits and 66 changed files, including profile sections/contacts/completion, resume persistence/import/generation/suggestions/JD analysis, and shared-workspace APIs. No changes were made in the backend checkout.

This assessment used the merged route handlers, request schemas, startup configuration, frontend models and backend handoffs. Handoff test counts are reported evidence, not fresh verification here. Frontend implementation/shared UI are unchanged from the previously verified 40 frontend tests and four builds. Backend database suites and authenticated browser flows were not rerun.

## What can be integrated in order

| Area                            | Merged server surface                                                                                                                               | Frontend status and next action                                                                                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal professional profile   | GET/POST/PUT `/api/v1/profile`, PUT `/profile/draft`; CRUD for Experience, Education, Skills, Projects and Certifications; POST `/profile/complete` | Profile remote is synthetic; onboarding remains a pending entry. First connect professional create/load/save/draft and verify reload, expiry and 409 conflict handling. Then add section forms and completion.                                                                           |
| Contacts                        | GET/PUT `/api/v1/profile/contact`                                                                                                                   | Keep separate from professional writes. Review dedicated contact permissions before connecting real contact fields.                                                                                                                                                                      |
| Resume persistence              | GET/list/import/generate, PUT, versions, clone/delete and JSON/text/Markdown/HTML download                                                          | Current editor uses a local rich-text draft. Agree and prove a lossless mapping before replacing Save locally. Keep rich text, dates, section/item IDs, language proficiency, visibility and appearance across save/reload. Binary PDF export is not supplied by these download formats. |
| JD, ATS and gap analysis        | JD parse/history/delete, resume tailoring and gap-analysis endpoints                                                                                | Implement after profile and durable resume flows pass. Treat current algorithms as deterministic heuristics; provider-backed AI and approved scoring requirements remain separate.                                                                                                       |
| AI review and shared workspaces | Suggest/apply/task retrieval and organization/vendor/member/grant/audit routes                                                                      | Hold frontend activation until the findings below and applicable policy/phase gates are resolved. Endpoint presence does not establish complete integration or privacy acceptance.                                                                                                       |

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

## Integration update — 2026-10-04

Professional profile integration and auth credential repair remain in place. The latest request removes required Create profile onboarding and adds the personal resume flow described above. `dev:personal` now builds/runs auth, profile, resume and gateway with four frontends. The backend checkout was unchanged. See the [tracker](../context/progress-tracker.md#resume-first-library-upload-and-persistence--2026-10-04) for actual final checks and limits. No claims of complete AI, F10, F19, PDF or shared privacy acceptance follow from this update.

## JD provider foundation — 2026-10-09

A stable `jd-match-v1` result and Textkernel Match V2 adapter are implemented and tested with mocked transport. They are server-internal and disabled by default; no authenticated JD endpoint or UI feature is ready to activate. The user has not created the selected trial account. Complete synthetic live entitlement verification, professional-data projection/remote preparation and durable cleanup, saved-version/permission/audit orchestration and result persistence before frontend wiring. Keep general readiness and legacy disabled tailoring distinct. See [ATS provider guide](ats-providers.md).

## Textkernel plan withdrawn — 2026-10-09

The user cancelled Textkernel signup/live integration after its corporate-email barrier. Do not wire the frontend to that provider. Existing adapter/result-contract work remains disabled and is not an HTTP-ready JD feature. Gemini/local matching is recommended for evaluation, subject to the JD rubric and permitted data mode; no replacement adapter or new UI/API was implemented. Odoo's free hosted plan cannot be used as our external scoring API. [Updated provider guide](ats-providers.md).
