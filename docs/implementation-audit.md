# Implementation audit — 2026-10-11

## Scope and evidence

This audit compares all 92 existing repository Markdown documents with source, manifests, scripts, migrations, route allowlists and tests in the `fixes` checkout. The reviewed-file register below includes root guidance, every context/spec/phase file, operational/reference docs, backend handoffs and package/template READMEs. Dependency/build output, private local files and user resume fixtures are excluded.

**Done** means a specific bounded capability exists and is connected where stated. **Partially done** separates implemented source from missing integration or acceptance. **Not started** means no feature implementation was found. An unchecked full-feature acceptance criterion is not evidence that none of its prerequisites exist. Historical test counts and browser observations remain dated evidence; they are not fresh test results from this audit.

The running local app is the personal resume flow. `services/resume-service/src/index.ts` selects `personalEditorOnly: true`; its allowlist and the gateway expose only approved editor/scoring/rewrite/PDF routes. Legacy route factories, handoffs, Prisma tables and tests are not proof of live product availability.

## Local Docker follow-up — 2026-10-11

✅ Full local Compose packaging now runs the current personal app, PostgreSQL/pgvector, existing migrations/restricted roles and audit delivery. See [Docker verification](docker-setup.md) for executed tests and Windows/provider limits. The original 92-document audit below remains a dated baseline; this addition does not complete hosted production, shared-workspace or other feature gaps.

## Feature register

| Feature | Status | Implemented evidence |
| --- | --- | --- |
| F01 Design system | ✅ Done for foundation scope | [packages/shared/src/index.ts](../packages/shared/src/index.ts) |
| F02 OAuth and sessions | Partially done | [services/auth-service/src/app.ts](../services/auth-service/src/app.ts) |
| F03 Database and persistence | Partially done | [packages/prisma-client/prisma/schema.prisma](../packages/prisma-client/prisma/schema.prisma) |
| F04 Individual profile entry | Partially done; entry scope changed | [services/profile-service/src/profile.ts](../services/profile-service/src/profile.ts) |
| F05 JD parser | Partially done | [services/resume-service/src/jd-parser.ts](../services/resume-service/src/jd-parser.ts) |
| F06 Generation and scoped suggestions | Partially done | [services/resume-service/src/ats/use-cases.ts](../services/resume-service/src/ats/use-cases.ts) |
| F07 Readiness and JD scoring | Partially done | [packages/resume-core/src/jd-scoring.ts](../packages/resume-core/src/jd-scoring.ts) |
| F08 Resume builder and preview | Partially done | [apps/resume-mfe/src/ManualResumeEditor.tsx](../apps/resume-mfe/src/ManualResumeEditor.tsx) |
| F09 PDF and storage | Partially done | [services/resume-service/src/pdf.ts](../services/resume-service/src/pdf.ts) |
| F10 Resume dashboard | Partially done | [apps/resume-mfe/src/ResumeLibrary.tsx](../apps/resume-mfe/src/ResumeLibrary.tsx) |
| F11 JD and optimization history | Partially done | [services/resume-service/src/resume.ts](../services/resume-service/src/resume.ts) |
| F12 Master profile editor | Partially done | [apps/profile-mfe/src/ProfileRemoteRoot.tsx](../apps/profile-mfe/src/ProfileRemoteRoot.tsx) |
| F13 Organization/vendor workspaces | Partially done; backend only | [services/workspace-service/src/workspace.ts](../services/workspace-service/src/workspace.ts) |
| F14 RBAC and privacy | Partially done; shared activation blocked | [packages/access-policy/src/index.ts](../packages/access-policy/src/index.ts) |
| F15 Audit logging/viewer | Partially done | [packages/prisma-client/src/audit-delivery.ts](../packages/prisma-client/src/audit-delivery.ts) |
| F16 LinkedIn archive import | Not started | [context/feature-specs/16-linkedin-import.md](../context/feature-specs/16-linkedin-import.md) |
| F17 Gap analysis | Partially done; backend and active JD evidence | [services/resume-service/src/gap-analyzer.ts](../services/resume-service/src/gap-analyzer.ts) |
| F18 MCP integration | Not started | [docs/mcp-integration.md](mcp-integration.md) |
| F19 File import | Partially done | [services/resume-service/src/upload.ts](../services/resume-service/src/upload.ts) |
| F20 Templates and formatting | Partially done | [apps/resume-mfe/src/templates/registry.ts](../apps/resume-mfe/src/templates/registry.ts) |

## Done capabilities and remaining scope

### F01 — Design system

**Status: Done for foundation scope.**

- [x] ✅ Shared tokens, shadcn-style controls, Performative adapters, React federation, responsive shell, device/light/dark theme and static/reduced-motion fallbacks. Evidence: [packages/shared/src/index.ts](../packages/shared/src/index.ts).

**Partially done / missing:** Full assistive-technology and sustained low-end rendering audits are release checks, not established by historical broad checkboxes.

### F02 — OAuth and sessions

**Status: Partially done.**

- [x] ✅ Google PKCE callback, provider-subject identity, transactional personal workspace bootstrap, revocable/rotating database refresh sessions, in-memory access grants, shell protection and direct library landing. Evidence: [services/auth-service/src/app.ts](../services/auth-service/src/app.ts).

**Partially done / missing:** LinkedIn has an unused provider module and disabled UI; callback/linking flow, hosted/distributed access and production cookie/identity configuration are missing. Mandatory profile onboarding was removed.

### F03 — Database and persistence

**Status: Partially done.**

- [x] ✅ Prisma models/migrations for identity, workspace, profile/contact/sections, JDs, resumes/immutable versions, tasks, audit/outbox and a private vector cache; five restricted runtime roles and role verification. Evidence: [packages/prisma-client/prisma/schema.prisma](../packages/prisma-client/prisma/schema.prisma).

**Partially done / missing:** Hosted provisioning, operational backup/restore, retention/purge, durable artifact/provenance/preset models and other embedding spaces remain unbuilt. Schema presence alone does not activate their APIs.

### F04 — Individual profile entry

**Status: Partially done; entry scope changed.**

- [x] ✅ Owned professional create/read/update/draft APIs, revision conflicts, section CRUD, completion endpoint, and a browser name/location/summary form. Evidence: [services/profile-service/src/profile.ts](../services/profile-service/src/profile.ts).

**Partially done / missing:** Full section/contact browser forms, reorder and reviewed completion are missing. The originally required wizard is superseded: resume creation and upload do not require a completed profile.

### F05 — JD parser

**Status: Partially done.**

- [x] ✅ Bounded deterministic parser with known skills/aliases, requirements/responsibilities/title/company handling. Active JD matching calls it; separate parse/history handlers also exist. Evidence: [services/resume-service/src/jd-parser.ts](../services/resume-service/src/jd-parser.ts).

**Partially done / missing:** Full provider-backed/pure-core parser contract, broad domain coverage and durable parsing/idempotent history workflow are missing. Standalone JD routes are blocked by the personal runtime allowlist and absent from the gateway.

### F06 — Generation and scoped suggestions

**Status: Partially done.**

- [x] ✅ Blank/reviewed-import version creation; paid Gemini saved Summary/experience/project description rewriting; validated stored proposals, word diff, reviewed exact-target atomic Apply, stale-version/hash checks and idempotent replay. Evidence: [services/resume-service/src/ats/use-cases.ts](../services/resume-service/src/ats/use-cases.ts).

**Partially done / missing:** Full profile-copy/JD generation, freeform action prompts, durable dispatch/status/cancel/retry, retained suggestion-history UI and structured fact provenance are missing. Legacy generator/suggest/apply handlers exist but remain gated and unsafe to activate as-is.

### F07 — Readiness and JD scoring

**Status: Partially done.**

- [x] ✅ Deterministic readiness-v2 (25/25/20/15/15), JD rules (30/25/20/15/10), optional paid Gemini evidence with vector candidates, persisted versioned assessments/preferences, exact-entry Fix/View/Reason and score-neutral Dismiss/Restore. Evidence: [packages/resume-core/src/jd-scoring.ts](../packages/resume-core/src/jd-scoring.ts).

**Partially done / missing:** Calibrated cross-domain corpus, PDF extraction/layout scoring, long-term assessment history, durable jobs and shared access are missing. These are internal heuristics; competitor weights and employer ATS algorithms are unknown.

### F08 — Resume builder and preview

**Status: Partially done.**

- [x] ✅ Strict EditorDocument with stable targets, manual fields/Tiptap, target dialogs, add/reorder/hide/delete, local history, save/reload/conflict handling, fit-width A4 stage, preview, score integration and owner PDF controls. Evidence: [apps/resume-mfe/src/ManualResumeEditor.tsx](../apps/resume-mfe/src/ManualResumeEditor.tsx).

**Partially done / missing:** Profile-copy creation UI, additional validated section kinds such as certifications/volunteering/custom sections, true paginated preview, saved-version restoration UI and full privacy/render parity remain incomplete. Resume-local contact editing does not update UserContact.

### F09 — PDF and storage

**Status: Partially done.**

- [x] ✅ Authenticated current-saved-version PDF stream in library/editor, worker time/concurrency limits, hidden/source/UI exclusion, ownership/version/expiry rechecks and download audit. Evidence: [services/resume-service/src/pdf.ts](../services/resume-service/src/pdf.ts).

**Partially done / missing:** R2/storage service, durable export/cache/checksum identity, historical/contact-free/shared variants, orphan cleanup and comprehensive multi-template Unicode/page-break parity are missing. HTML preview and React PDF are separate renderers.

### F10 — Resume dashboard

**Status: Partially done.**

- [x] ✅ Owned list/create/open, editor rename, loaded-row title search/update-or-name sort, 50-row cursor pages/Load more, accurate Saved/version labels, confirmed tombstone delete/one-page-session undo and saved PDF actions. Evidence: [apps/resume-mfe/src/ResumeLibrary.tsx](../apps/resume-mfe/src/ResumeLibrary.tsx).

**Partially done / missing:** Global query-bound search/sort/ATS sorting, clone and saved-history UI, active/default preference, durable trash and automatic artifact purge are missing. Legacy clone/versions handlers exist but are disabled in the running personal app; rename currently creates a content version.

### F11 — JD and optimization history

**Status: Partially done.**

- [x] ✅ JDHistory model plus parse/save/list/detail/delete use cases and route handlers; current JD input/result is retained in private assessment metadata. Evidence: [services/resume-service/src/resume.ts](../services/resume-service/src/resume.ts).

**Partially done / missing:** No connected JD history/reuse/timeline screen, history routes through gateway, authorized restore-as-new-version flow or durable provenance timeline. The sidebar route is a placeholder, not a working history feature.

### F12 — Master profile editor

**Status: Partially done.**

- [x] ✅ Optional real name/location/summary form; server-owned section list/add/update/delete, separate contact DTO/endpoints and expected-revision professional writes. Evidence: [apps/profile-mfe/src/ProfileRemoteRoot.tsx](../apps/profile-mfe/src/ProfileRemoteRoot.tsx).

**Partially done / missing:** Section/contact frontend integration, reorder, complete contact permission/audit contract, profile vector invalidation and derived-resume freshness UI remain missing. Master edits and resume edits stay separate.

### F13 — Organization/vendor workspaces

**Status: Partially done; backend only.**

- [x] ✅ Workspace/member/grant use cases and route factory with creation, details/settings, invitations as membership records, role/removal and last-owner checks. Evidence: [services/workspace-service/src/workspace.ts](../services/workspace-service/src/workspace.ts).

**Partially done / missing:** Dedicated safe startup/runtime identity, gateway and shell integration, complete token-bound invite accept/revoke/resend/delivery, consent enforcement across resources and race-proof shared E2E release are missing. The audit-only launcher does not enable these routes.

### F14 — RBAC and privacy

**Status: Partially done; shared activation blocked.**

- [x] ✅ Canonical 27 permissions, personal actor/ownership/action checks, contact-free scoring/AI projections and a workspace role resolver with unit coverage. Evidence: [packages/access-policy/src/index.ts](../packages/access-policy/src/index.ts).

**Partially done / missing:** Complete agreed role matrix and cross-service output/history/PDF/task/MCP privacy enforcement are missing. Contact handlers use broad professional permissions; shared viewer grants differ from the documented read-only bundle. Do not activate shared access before repairs.

### F15 — Audit logging/viewer

**Status: Partially done.**

- [x] ✅ Content-free validation, atomic capture, persisted outbox claims/backoff/leases, authenticated loopback ingestion, append-only runtime ledger and foreground delivery worker. Workspace audit-list handler exists. Evidence: [packages/prisma-client/src/audit-delivery.ts](../packages/prisma-client/src/audit-delivery.ts).

**Partially done / missing:** Connected audit viewer, complete per-action/denial/contact event coverage, shared transport, production identities/supervision, retention/deletion and remediation UI are missing. A query API is not a delivered viewer.

### F16 — LinkedIn archive import

**Status: Not started.**

No archive import/review/merge implementation. The unused OAuth provider helper is not archive import.

**Not started:** Archive format/limits, safe unpacking, provenance/conflict review, permissioned atomic master merge and temporary-artifact cleanup all need building.

### F17 — Gap analysis

**Status: Partially done; backend and active JD evidence.**

- [x] ✅ Legacy gap service distinguishes matched, supported-but-omitted and unsupported requirements using profile facts and exact/synonym matching. Active JD panel supplies matched/missing resume evidence. Evidence: [services/resume-service/src/gap-analyzer.ts](../services/resume-service/src/gap-analyzer.ts).

**Partially done / missing:** Legacy gap API is runtime/gateway gated. Connect a verified profile-versus-resume comparison UI, fresh-input/model caching and scoped gap-to-target actions; broader semantic calibration remains missing. Current JD matching does not imply the full F17 workflow.

### F18 — MCP integration

**Status: Not started.**

Seven tools are specified in documentation; no MCP server, SDK integration or registered tools exist.

**Not started:** Transport/auth, adapters using existing authorized use cases, run handles, client configuration and REST/MCP parity tests all need building. Cover-letter and arbitrary storage tools stay excluded.

### F19 — File import

**Status: Partially done.**

- [x] ✅ Local bounded PDF.js/Mammoth/TXT/MD workers, two-column parsing corrections, library upload modal, editable staging, explicit idempotent Confirm and save, private source-text persistence without master/contact writes. Raw text UI is reversibly disabled. Evidence: [services/resume-service/src/upload.ts](../services/resume-service/src/upload.ts).

**Partially done / missing:** OCR/legacy DOC, arbitrary-layout coverage, field confidence/provenance, private upload staging/expiry, source retention/purge and shared contact separation remain missing. Reviewed imports are bounded, not universal extraction.

### F20 — Templates and formatting

**Status: Partially done.**

- [x] ✅ Classic/Modern/Editorial registry/gallery, strict appearance bounds, density/margins/fonts/colors, reset/undo/cancel and exact appearance snapshots in immutable saves and PDF rendering. Evidence: [apps/resume-mfe/src/templates/registry.ts](../apps/resume-mfe/src/templates/registry.ts).

**Partially done / missing:** Alternate layouts, durable template/font/renderer identity, personal/shared reusable presets, readable fit-to-one-page proposal and full browser/PDF parity remain missing. Three styles share one single-column layout.

## Cross-cutting planned items

| Planned item | Audit result and evidence |
| --- | --- |
| Package graph, strict TypeScript, federation, shared UI, lint/build/tests | ✅ Root manifests, four apps and server/shared packages exist. Native Node test runners are used; not every package defines every Turbo task. |
| Google and LinkedIn login | ✅ Google local flow; LinkedIn callback/account linking is not built. Local opaque credentials are used rather than the proposed JWT deployment design. |
| Required profile wizard | Superseded by the user. Optional profile editing exists; do not reinstate a mandatory entry gate. |
| Zustand/TanStack Query state architecture | Planned. Current flows primarily use React state and the shared session/API controller; these libraries are not the active cache architecture. |
| Shared authorization / AI packages | Actual packages are access-policy and service-local ats adapters. Planned authorization/ai-provider package paths do not exist. |
| Durable Trigger.dev jobs and Vercel AI SDK | Not started as integrations. TaskRun storage/legacy synchronous handlers exist; Gemini currently uses bounded server REST calls. |
| Vector search | ✅ ResumeSearchChunk, gemini-embedding-001/768/professional-v1, RLS, scoped exact cosine retrieval and save/delete invalidation. Profile/JD 1536 and skill 384 columns are unbuilt proposals. HNSW exists but current bounded exact query does not use it. |
| Cloudflare Pages/Neon/Node container deployment | ✅ Full local Docker app; hosted deployment, CI release pipeline and production configuration remain planned/unverified. |
| R2/storage service/signed links | Not started. PDF is an authenticated ephemeral stream; upload bytes are discarded after parsing. |
| Retention/backup/restore/rate and cost operations | Partial request/size/time/concurrency bounds; production quotas, retention/purge, alerting and operational restore procedures remain missing. |
| Task bookkeeping | ✅ Moved from product README to context/development-status.md; lock/owner semantics remain in scripts/development-task.mjs. |
| Additional custom sections and rendering | Partial typed supported sections; certifications/volunteering/custom section UI and shared rendering contracts still need work. |
| Cover letters, billing, jobs, recruitment and candidate ranking | Excluded or unallocated scope. They are not unfinished approved product tasks. |

## Outdated statements and contradictions

| Finding | Current source and documentation action |
| --- | --- |
| Overview/workflow/validation say documentation-only or development not begun | Source, manifests and tests are implemented. Current canonical summaries now describe the personal app; dated logs remain historical. Context approval is cleared. |
| F05/F11/F12/F13/F14/F17 say Not started | Parser/history/profile/workspace/role/gap source exists. Changed to Partial with exact integration gates rather than claiming full acceptance. |
| Plans ask to rebuild Education, local forms or durable editor persistence | These implementations already exist. Current phase checklists and starter guidance now distinguish done personal slices from missing broader features. |
| Old README mixes product setup, task ownership and 2026-09/10 implementation logs | Replaced with setup/use only. History preserved in archive/readme-history.md; links rebased. Task state moved into context/development-status.md. |
| .env.example advertises inactive ports, LinkedIn, JWT, R2 and Trigger settings; copied blank OAuth values fail optional nonempty validation | Example now lists configured Google and optional paid Gemini only. Generated credentials and fixed ports are documented separately. |
| Root Node engine >=22.0.0 is looser than installed Prisma | Prisma 7.10.0 requires ^20.19, ^22.12 or >=24. README requires supported 22.12+ in 22.x or 24+. Root engine declaration is a follow-up code/config change, not altered in this documentation task. |
| Google docs still route to profile setup/sample or offer sign-out on /sign-in | Verified sessions land in My resumes; Preferences has sign-out. Current instructions corrected; dated OAuth failure observations remain history. |
| State/AI/storage diagrams imply installed infrastructure | Current architecture separates actual React state, REST Gemini, local PostgreSQL/PDF from planned Query/Zustand, Trigger, AI SDK, R2, Neon and MCP. |
| D07 unresolved/no vector columns; source ERD fixes 1536/384 | Resume vector slice is approved and implemented at 768 dimensions; other spaces remain unimplemented. Historical extension-only output is not application state. |
| Textkernel/OpenCode setup still appears in older plans | Removed from active runtime/dependencies; paid Gemini is active. Legacy stored proposal model identifiers remain compatibility data. |
| Runtime role guide says four roles and no DELETE anywhere | There are five roles; profile section tables and resume derived cache have narrow DELETE grants. Source resume deletion is a tombstone; AuditEvent stays append-only. Guide corrected to the actual allowlist. |
| Backend handoff says complete Phase 4 and audit viewer | Backend routes exist, but startup, app/gateway integration, invitation/consent and complete privacy verification do not. Handoff marked historical source evidence; F13–F15 remain partial. |
| Old task/branch guidance selects features or ux-ui-update | Current branch is fixes in the existing frontend worktree. Active workflow corrected; historical branch records are not instructions. |
| Template MFE, fit-page controls, temporary preview and streamed reasoning are implied by dated notes | Templates live inside resume MFE; fit width is automatic, no inert A4/zoom strip; normal AI uses server rewrite. TokenStream plays validated notices rather than network reasoning. |
| Raw extracted text view/save described as available | Disabled with apps/resume-mfe/src/ui-features.ts. Parsing and private persisted source remain intact; hiding UI does not delete underlying data. |
| Broad old acceptance checks imply full accessibility/performance/PDF compliance | Dated evidence remains bounded. Full accessibility, low-end performance, corpus quality and all-layout PDF parity remain release work. |

## Priority findings in existing source

1. **Contact authorization/audit:** `getContact` and `updateContact` in [services/profile-service/src/profile.ts](../services/profile-service/src/profile.ts) use `profile.read`/`profile.update` and profile events, rather than canonical contact permissions/events. Current ownership limits do not satisfy the broader field-privacy contract.
2. **Legacy suggestion grounding and Apply:** [services/resume-service/src/suggestion-engine.ts](../services/resume-service/src/suggestion-engine.ts) adds a 35% latency claim for `quantify`; [services/resume-service/src/generator-contracts.ts](../services/resume-service/src/generator-contracts.ts) accepts client `appliedContent`, and legacy Apply does not use the active stored-proposal contract. These routes stay gated. The active `/ai-rewrite` path uses separate validated server proposals.
3. **Shared workspace startup:** [services/workspace-service/src/index.ts](../services/workspace-service/src/index.ts) defaults to port 4003, a literal database login and an all-zero auth key; the safe audit-only helper uses port 4005. Do not connect the business entrypoint until it has guarded restricted credentials and a nonconflicting port.
4. **Shared role mapping:** [services/workspace-service/src/rbac.ts](../services/workspace-service/src/rbac.ts) uses one common bundle, including `resume.create`/`resume.update`, for non-admin shared roles. This does not match the documented read-only viewer bundle or full typed role matrix.
5. **Data lifecycle:** score/proposal JSON has bounded retained arrays but no purge; resume delete retains versions. Field-level imported/manual fact provenance and downstream artifact privacy are incomplete. Do not call deletion permanent or AI validation proof of truth.

No product logic, credentials, database rows, grants or provider settings were changed to resolve these findings during the audit.

## Setup verification

README commands map to real root/package scripts; environment names map to actual config readers. Verified Google callback, fixed ports, local initialization order, automatic worktree root resolution, separate audit startup and optional paid Gemini prerequisites. Installed tooling: Node 22.12.0, pnpm 12.6.0, PostgreSQL 18.3 and pgvector 0.8.7. README excludes inactive credentials and accounts for Prisma's stricter engine.

Fresh validation in the active fixes worktree:

| Command / check | Result |
| --- | --- |
| pnpm install --frozen-lockfile | Passed; 16 workspace projects; lockfile resolution unchanged. |
| pnpm build | Passed; 15/15 tasks, no cached builds. |
| pnpm check | Passed; 34/34 lint/typecheck tasks, 6 cached tasks. |
| pnpm test | Passed; all 12 test suites executed without test-cache replay; 270/270 tests. Supporting build tasks used cache. |
| pnpm task:test | Passed after helper relocation/formatting; 7/7 synthetic ownership/local-vector-config tests. |
| node --check scripts/development-task.mjs | Passed. |
| Markdown relative targets, fragments and fences | Passed across 95 current Markdown files; 1,016 local links, zero missing files/fragments or unbalanced fences. |
| Capability coverage table | All 26 rows have correctly separated status/source columns. |
| git diff --check | Passed. |

The three new Markdown files are this report, the task-status document and the historical README archive; the original reviewed register remains 92 files. A fresh clone/database bootstrap, database integration suites and live OAuth/Gemini calls were not run. Initialization commands and environment names were checked against source, not executed against the shared cluster. No database provisioning, migration, credential rotation or runtime restart occurred. Cached checks are identified rather than presented as freshly executed tests.

The only new code adjustment is relocating the existing internal task helper to context/development-status.md and preserving its owner/lock semantics. Its regression verifies README stays unchanged. Existing UI fixes remain untouched by this documentation task.

## Reviewed documentation register

Each entry was read/indexed for planned scope, status claims, commands and links. Current contracts and acceptance lists were compared to source; dated logs/reference inspections are retained as historical evidence. Source plans and handoffs cannot override the feature register above.

- [AGENTS.md](../AGENTS.md) — Current contract, scope or workflow.
- [README.md](../README.md) — Rewritten setup; prior history archived.
- [apps/resume-mfe/src/templates/README.md](../apps/resume-mfe/src/templates/README.md) — Current contract, scope or workflow.
- [context/README.md](../context/README.md) — Current contract, scope or workflow.
- [context/ai-workflow-rules.md](../context/ai-workflow-rules.md) — Current contract, scope or workflow.
- [context/architecture-context.md](../context/architecture-context.md) — Current contract, scope or workflow.
- [context/authorization-model.md](../context/authorization-model.md) — Current contract, scope or workflow.
- [context/build-plan.md](../context/build-plan.md) — Current contract, scope or workflow.
- [context/build-plans/00-context-review.md](../context/build-plans/00-context-review.md) — Current contract, scope or workflow.
- [context/build-plans/01-foundation.md](../context/build-plans/01-foundation.md) — Current contract, scope or workflow.
- [context/build-plans/02-ai-pipeline.md](../context/build-plans/02-ai-pipeline.md) — Current contract, scope or workflow.
- [context/build-plans/03-individual-flow.md](../context/build-plans/03-individual-flow.md) — Current contract, scope or workflow.
- [context/build-plans/04-multi-tenant.md](../context/build-plans/04-multi-tenant.md) — Current contract, scope or workflow.
- [context/build-plans/05-advanced.md](../context/build-plans/05-advanced.md) — Current contract, scope or workflow.
- [context/build-plans/06-builder-expansion.md](../context/build-plans/06-builder-expansion.md) — Current contract, scope or workflow.
- [context/code-standards.md](../context/code-standards.md) — Current contract, scope or workflow.
- [context/data-model.md](../context/data-model.md) — Current contract, scope or workflow.
- [context/decisions.md](../context/decisions.md) — Current contract, scope or workflow.
- [context/error-and-fix-log.md](../context/error-and-fix-log.md) — Historical source/evidence.
- [context/feature-specs/01-design-system.md](../context/feature-specs/01-design-system.md) — Current contract, scope or workflow.
- [context/feature-specs/02-auth-oauth.md](../context/feature-specs/02-auth-oauth.md) — Current contract, scope or workflow.
- [context/feature-specs/03-database-schema.md](../context/feature-specs/03-database-schema.md) — Current contract, scope or workflow.
- [context/feature-specs/04-profile-wizard.md](../context/feature-specs/04-profile-wizard.md) — Current contract, scope or workflow.
- [context/feature-specs/05-jd-parser.md](../context/feature-specs/05-jd-parser.md) — Current contract, scope or workflow.
- [context/feature-specs/06-resume-generator.md](../context/feature-specs/06-resume-generator.md) — Current contract, scope or workflow.
- [context/feature-specs/07-ats-scoring.md](../context/feature-specs/07-ats-scoring.md) — Current contract, scope or workflow.
- [context/feature-specs/08-resume-preview.md](../context/feature-specs/08-resume-preview.md) — Current contract, scope or workflow.
- [context/feature-specs/09-pdf-export.md](../context/feature-specs/09-pdf-export.md) — Current contract, scope or workflow.
- [context/feature-specs/10-resume-dashboard.md](../context/feature-specs/10-resume-dashboard.md) — Current contract, scope or workflow.
- [context/feature-specs/11-jd-history.md](../context/feature-specs/11-jd-history.md) — Current contract, scope or workflow.
- [context/feature-specs/12-profile-editor.md](../context/feature-specs/12-profile-editor.md) — Current contract, scope or workflow.
- [context/feature-specs/13-workspace-management.md](../context/feature-specs/13-workspace-management.md) — Current contract, scope or workflow.
- [context/feature-specs/14-rbac-privacy.md](../context/feature-specs/14-rbac-privacy.md) — Current contract, scope or workflow.
- [context/feature-specs/15-audit-logging.md](../context/feature-specs/15-audit-logging.md) — Current contract, scope or workflow.
- [context/feature-specs/16-linkedin-import.md](../context/feature-specs/16-linkedin-import.md) — Current contract, scope or workflow.
- [context/feature-specs/17-keyword-gap-analysis.md](../context/feature-specs/17-keyword-gap-analysis.md) — Current contract, scope or workflow.
- [context/feature-specs/18-mcp-integration.md](../context/feature-specs/18-mcp-integration.md) — Current contract, scope or workflow.
- [context/feature-specs/19-resume-file-import.md](../context/feature-specs/19-resume-file-import.md) — Current contract, scope or workflow.
- [context/feature-specs/20-template-customization.md](../context/feature-specs/20-template-customization.md) — Current contract, scope or workflow.
- [context/frontend-integration.md](../context/frontend-integration.md) — Current contract, scope or workflow.
- [context/phase-1-decision-review.md](../context/phase-1-decision-review.md) — Current contract, scope or workflow.
- [context/progress-tracker.md](../context/progress-tracker.md) — Current contract, scope or workflow.
- [context/project-overview.md](../context/project-overview.md) — Current contract, scope or workflow.
- [context/resume-capability-coverage.md](../context/resume-capability-coverage.md) — Current contract, scope or workflow.
- [context/resume-editing-contract.md](../context/resume-editing-contract.md) — Current contract, scope or workflow.
- [context/ui-context.md](../context/ui-context.md) — Current contract, scope or workflow.
- [context/validation-strategy.md](../context/validation-strategy.md) — Current contract, scope or workflow.
- [docs/actor-resolution.md](actor-resolution.md) — Current contract, scope or workflow.
- [docs/ai-preview-verification.md](ai-preview-verification.md) — Historical source/evidence.
- [docs/api-reference.md](api-reference.md) — Current contract, scope or workflow.
- [docs/ats-providers.md](ats-providers.md) — Current contract, scope or workflow.
- [docs/ats-workflow.md](ats-workflow.md) — Current contract, scope or workflow.
- [docs/careerzenith-ats-comparison.md](careerzenith-ats-comparison.md) — Historical source/evidence.
- [docs/careerzenith-builder-review.md](careerzenith-builder-review.md) — Historical source/evidence.
- [docs/database-foundation.md](database-foundation.md) — Current contract, scope or workflow.
- [docs/deployment.md](deployment.md) — Current contract, scope or workflow.
- [docs/development-prompts.md](development-prompts.md) — Current contract, scope or workflow.
- [docs/editor-panels-verification.md](editor-panels-verification.md) — Historical source/evidence.
- [docs/experience-api.md](experience-api.md) — Current contract, scope or workflow.
- [docs/frontend-api-readiness.md](frontend-api-readiness.md) — Current contract, scope or workflow.
- [docs/frontend-editor-plan.md](frontend-editor-plan.md) — Current contract, scope or workflow.
- [docs/google-login.md](google-login.md) — Current contract, scope or workflow.
- [docs/handoffs/backend-certifications.md](handoffs/backend-certifications.md) — Historical handoff.
- [docs/handoffs/backend-contact-and-deletions.md](handoffs/backend-contact-and-deletions.md) — Historical handoff.
- [docs/handoffs/backend-education-update.md](handoffs/backend-education-update.md) — Historical handoff.
- [docs/handoffs/backend-education.md](handoffs/backend-education.md) — Historical handoff.
- [docs/handoffs/backend-gap-analysis.md](handoffs/backend-gap-analysis.md) — Historical handoff.
- [docs/handoffs/backend-jd-tailoring.md](handoffs/backend-jd-tailoring.md) — Historical handoff.
- [docs/handoffs/backend-multi-tenant-workspaces.md](handoffs/backend-multi-tenant-workspaces.md) — Historical handoff.
- [docs/handoffs/backend-projects.md](handoffs/backend-projects.md) — Historical handoff.
- [docs/handoffs/backend-resume-features.md](handoffs/backend-resume-features.md) — Historical handoff.
- [docs/handoffs/backend-resume-generator.md](handoffs/backend-resume-generator.md) — Historical handoff.
- [docs/handoffs/backend-resume-import.md](handoffs/backend-resume-import.md) — Historical handoff.
- [docs/handoffs/backend-skills.md](handoffs/backend-skills.md) — Historical handoff.
- [docs/manual-editor-contract.md](manual-editor-contract.md) — Current contract, scope or workflow.
- [docs/manual-editor-verification.md](manual-editor-verification.md) — Historical source/evidence.
- [docs/mcp-integration.md](mcp-integration.md) — Current contract, scope or workflow.
- [docs/parallel-development.md](parallel-development.md) — Current contract, scope or workflow.
- [docs/profile-api.md](profile-api.md) — Current contract, scope or workflow.
- [docs/resume-runtime-approval.md](resume-runtime-approval.md) — Current contract, scope or workflow.
- [docs/resume-vector-search.md](resume-vector-search.md) — Current contract, scope or workflow.
- [docs/runtime-database-roles.md](runtime-database-roles.md) — Current contract, scope or workflow.
- [docs/scheduled-development.md](scheduled-development.md) — Current contract, scope or workflow.
- [docs/source-plan.md](source-plan.md) — Historical source/evidence.
- [docs/ui-redesign-review.md](ui-redesign-review.md) — Historical source/evidence.
- [docs/ux-ui-update-plan.md](ux-ui-update-plan.md) — Current contract, scope or workflow.
- [docs/ux-ui-update-verification.md](ux-ui-update-verification.md) — Historical source/evidence.
- [docs/workspace-sidebar-verification.md](workspace-sidebar-verification.md) — Historical source/evidence.
- [packages/access-policy/README.md](../packages/access-policy/README.md) — Current contract, scope or workflow.
- [packages/audit-contracts/README.md](../packages/audit-contracts/README.md) — Current contract, scope or workflow.
- [packages/resume-core/README.md](../packages/resume-core/README.md) — Current contract, scope or workflow.
- [project-tracker.md](../project-tracker.md) — Current contract, scope or workflow.

## Prioritized next work

1. Repair contact permissions/events and legacy grounding/Apply; keep those routes gated until privacy/version regressions pass. Add safe workspace runtime configuration and the exact approved read-only role matrix before any shared activation.
2. Strengthen the current personal flow with a synthetic varied-layout import/scoring corpus, readable multi-page preview, Unicode/page-break/template PDF parity and accessibility checks. Do not tune scores to imitate an unknown competitor algorithm.
3. Add durable generation/rewrite/index/export orchestration with owned handles, cancellation/retry/replay, quotas/cost bounds and retention/provenance. Reuse the active provider and reviewed Apply contracts.
4. Connect optional master-profile section/contact forms and reorder after the contact policy repair; preserve resume-first entry.
5. Complete shared invite acceptance/consent, cross-service resource grants, revocation, privacy variants and an audit viewer before enabling organization/vendor UI.
6. Implement approved hosting, private artifact storage, production service identity/session configuration, supervised audit delivery, backup/restore and lifecycle cleanup before public release.
7. Add LinkedIn archive review/merge and the seven MCP tools after stable domain/privacy contracts. Leave recruitment, candidate ranking, cover letters and billing outside this release.
