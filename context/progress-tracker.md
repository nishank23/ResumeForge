# Progress Tracker

**Last updated:** 2026-10-01

**Current stage:** Phase 1 in progress — P1.1/P1.2 complete; P1.3 personal-scope, audit contracts and initial local identity migration verified on 2026-09-30.

**Context approved by user:** Yes — 2026-09-29 ("I confirm everything").

**Development authorized:** Active — P1.1 and P1.2 (F01) complete; P1.3 (F03) in progress.

**Implementation completed:** 1 of 20 features complete (F01 Design system verified; F19/F20 allocated to proposed Phase 6).

Current review: [comprehensive capability coverage](resume-capability-coverage.md), proposed [Phase 6](build-plans/06-builder-expansion.md), [Performative UI integration](frontend-integration.md) and [contextual resume editing](resume-editing-contract.md), requested on 2026-09-29. The same-day follow-up includes suitable backgrounds/surfaces/accents and signed-in Chrome editor findings. Visual concepts are paused. The selected library and interaction direction are recorded; detailed contracts and unrelated foundation decisions remain under review.

This is the canonical status file. [project-tracker.md](../project-tracker.md) links here rather than duplicating progress.

## Current goal

Complete Phase 1 Foundation. P1.1 toolchain/scaffold and P1.2 shared UI/shell (F01) are complete. P1.3 is in progress: the unblocked personal-scope policy and content-free audit-intent contracts are verified; the initial local identity/workspace/profile migration is verified. Remaining persistence tables and durable audit delivery are pending; vectors remain gated by D07.

## Documentation checklist

- [x] Read the supplied plan and organize the documentation structure.
- [x] Save a working planning baseline in docs/source-plan.md with the standalone project layout.
- [x] Create six core context documents and the context index.
- [x] Create 18 baseline specs, then add F19/F20 for comprehensive builder coverage.
- [x] Create context review, five baseline phase plans and proposed Phase 6.
- [x] Add data, authorization, validation, API, deployment, and MCP contracts.
- [x] Add root AGENTS.md, README.md, and project-tracker.md.
- [x] Record confirmed choices, draft proposals, reconciliations, and open decisions separately.
- [x] Verify links, file coverage, phase IDs, permission names, fence balance, and product-requirement coverage.
- [x] Receive the user's context confirmation.
- [x] Record the cleared context gate and prompt-only boundary for this turn.

## Phase status

| Phase                                                               | State                                              | Exit evidence                                                                                                                                       |
| ------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context                                                             | Approved by user                                   | 2026-09-29 confirmation                                                                                                                             |
| [1 — Foundation](build-plans/01-foundation.md)                      | **In progress — P1.1/P1.2 complete; P1.3 started** | Workspace scaffold, F01 UI/federation, personal scope policy, and safe audit-intent validation pass; database-backed F03 acceptance remains pending |
| [2 — AI pipeline](build-plans/02-ai-pipeline.md)                    | Not started                                        | None; no application implementation                                                                                                                 |
| [3 — Complete individual flow](build-plans/03-individual-flow.md)   | Not started                                        | None; no application implementation                                                                                                                 |
| [4 — Multi-tenant](build-plans/04-multi-tenant.md)                  | Not started                                        | None; no application implementation                                                                                                                 |
| [5 — Advanced](build-plans/05-advanced.md)                          | Not started                                        | None; no application implementation                                                                                                                 |
| [6 — Resume builder expansion](build-plans/06-builder-expansion.md) | Proposed allocation; Not started                   | F19/F20 specs drafted; no implementation                                                                                                            |

## Feature status

“Spec drafted” means documentation exists. It does not mean the feature works or that its proposed details are approved.

| ID  | Phase      | Feature/spec                                                           | Context      | Implementation                   | Verification                                                                             |
| --- | ---------- | ---------------------------------------------------------------------- | ------------ | -------------------------------- | ---------------------------------------------------------------------------------------- |
| F01 | 1          | [Design system](feature-specs/01-design-system.md)                     | Spec drafted | **Complete (P1.2)**              | **Passed** (`pnpm build`, `pnpm check`, production federation & CSS token audit)         |
| F02 | 1          | [Google + LinkedIn OAuth](feature-specs/02-auth-oauth.md)              | Spec drafted | Scaffolding complete (LinkedIn Secrets Pending) | Manual Google OAuth test pending                                                         |
| F03 | 1          | [Database schema + Prisma](feature-specs/03-database-schema.md)        | Spec drafted | **In progress (P1.3 persistence)** | 21 policy/contract tests; local migration plus 7 database subtests and restore passed |
| F04 | 1          | [Individual profile wizard](feature-specs/04-profile-wizard.md)        | Spec drafted | Not started                      | Not run                                                                                  |
| F05 | 2          | [JD parser](feature-specs/05-jd-parser.md)                             | Spec drafted | Not started                      | Not run                                                                                  |
| F06 | 2          | [Resume generator + suggestions](feature-specs/06-resume-generator.md) | Spec drafted | Not started                      | Not run                                                                                  |
| F07 | 2          | [ATS scoring + breakdown](feature-specs/07-ats-scoring.md)             | Spec drafted | Not started                      | Not run                                                                                  |
| F08 | 2          | [Resume builder + preview](feature-specs/08-resume-preview.md)         | Spec drafted | Not started                      | Not run                                                                                  |
| F09 | 3          | [PDF export + R2](feature-specs/09-pdf-export.md)                      | Spec drafted | Not started                      | Not run                                                                                  |
| F10 | 3          | [Resume dashboard](feature-specs/10-resume-dashboard.md)               | Spec drafted | Not started                      | Not run                                                                                  |
| F11 | 3          | [JD history](feature-specs/11-jd-history.md)                           | Spec drafted | Not started                      | Not run                                                                                  |
| F12 | 3          | [Profile editor](feature-specs/12-profile-editor.md)                   | Spec drafted | Not started                      | Not run                                                                                  |
| F13 | 4          | [Workspace management](feature-specs/13-workspace-management.md)       | Spec drafted | Not started                      | Not run                                                                                  |
| F14 | 4          | [RBAC + privacy](feature-specs/14-rbac-privacy.md)                     | Spec drafted | Not started                      | Not run                                                                                  |
| F15 | 4          | [Audit logging](feature-specs/15-audit-logging.md)                     | Spec drafted | Phase 1 contract foundation only | 12/12 contract tests; delivery, persistence and viewer not started                       |
| F16 | 5          | [LinkedIn data import](feature-specs/16-linkedin-import.md)            | Spec drafted | Not started                      | Not run                                                                                  |
| F17 | 5          | [Keyword gap analysis](feature-specs/17-keyword-gap-analysis.md)       | Spec drafted | Not started                      | Not run                                                                                  |
| F18 | 5          | [MCP integration](feature-specs/18-mcp-integration.md)                 | Spec drafted | Not started                      | Not run                                                                                  |
| F19 | 6 proposed | [Existing resume file import](feature-specs/19-resume-file-import.md)  | Spec drafted | Not started                      | Not run                                                                                  |
| F20 | 6 proposed | [Template customization](feature-specs/20-template-customization.md)   | Spec drafted | Not started                      | Not run                                                                                  |

## In progress

**P1.3 — Persistence and access foundations (F03) (in progress).** Added `@resume-forge/access-policy` with the exact 27-name capability vocabulary and fail-closed personal ownership/scope decisions. Added `@resume-forge/audit-contracts` with the 22 documented event names, authoritative actor/workspace/resource fields, explicit outcomes, canonical UTC timestamps and allowlisted identifier/status metadata. Raw content, unknown keys, URLs, emails, nested values and action/resource/outcome mismatches are rejected. Initial persistence and grant models are now implemented; shared-workspace routes, role bundles, session rotation, audit delivery and sensitive-read enforcement remain unimplemented.

## Decisions awaiting review

See [decisions.md](decisions.md) for proposed options and exact boundaries.

| Decision group               | IDs                                                                               | Effect                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Original product questions   | D01 billing; D02 vendor consent                              | Billing can remain future scope; vendor consent flow remains Phase 4; D03 approved                                                  |
| Foundation design            | D11 retention/deletion periods (durability approved)           | D03/D04/D08 and D11 durability approved 2026-09-30; retention required before real-data deployment |
| AI and content               | D07 embedding dimensions/model; D09 ATS rubric; D12 contact-safe rendering/export | Resolve before vectors, scoring, and content/artifact contracts                                                                 |
| Shared policy and operations | D05 full role grants; D10 hosting/domains/invitations                             | Resolve before affected integrations and shared release                                                                         |
| Additional intake            | D14 PDF/DOC/DOCX resume import                                                    | F19 in proposed Phase 6; formats/parser/limits/retention remain open before implementation                                      |

## Next step

P1.4 shell session bootstrap and cross-tab refresh/logout coordination are implemented. Next unblocked slice: protected workspace routing and the authenticated onboarding transition, after checking the remaining F03 service authorization/audit prerequisites for persisted private data. Sample preview remains public and separate. LinkedIn implementation is **on hold at the user's request (2026-10-01), awaiting OAuth credentials and provider configuration**; do not work on or mark it complete until resumed. Google real-provider consent verification, account linking, P1.3 scope constraints/service roles and durable audit capture/delivery remain pending.

## Historical verification evidence — 2026-09-28

Documentation checks executed on 2026-09-28 using Python standard-library filesystem/regex validation:

| Check                   | Actual result                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Document inventory      | 43 Markdown files; new project files are documentation only                                                                        |
| Core and root documents | All six core context files, context index, root README/AGENTS/tracker present                                                      |
| Feature coverage        | 18 unique specs, sequential 01–18, correct five-phase mapping, acceptance checklists present                                       |
| Phase plans             | Context review plus five build plans; all implementation tasks remain unchecked                                                    |
| Local links and fences  | No broken local Markdown links; all code fences balanced                                                                           |
| Permission fidelity     | Exactly 27 canonical permission names; exact set matches the source plan                                                           |
| Planning baseline       | docs/source-plan.md retains the supplied product requirements with the folder layout normalized to this standalone project         |
| Standalone workspace    | All 43 Markdown files use this project's context; workspace-wide name/content scan and refreshed local code-search cache are clean |
| Status integrity        | Every feature is Not started; no user approval recorded                                                                            |

A targeted text review found no leftover placeholder TODO/TBD sections. Proposed policies and unresolved decisions remain labeled for review.

No application tests/builds have been run because no resume-forge implementation exists.

## Session log

| Date       | Work                                                     | Result / boundary                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | Initial context preparation from the user's plan         | Documentation drafted; consistent 18-feature roadmap; no implementation started                                                                                                                                                                                                                                                                                                                         |
| 2026-09-28 | Documentation consistency and product-requirement checks | Passed; context ready for user review, development still not started                                                                                                                                                                                                                                                                                                                                    |
| 2026-09-28 | Standalone documentation cleanup                         | Updated paths, instructions, planning baseline, and status history to describe only resume-forge; refreshed local search metadata and verified all 43 documents; user review remains pending.                                                                                                                                                                                                           |
| 2026-09-28 | Phase 1 decision and visual-direction review             | Added plain-language recommendations and recorded the modern animated UI requirement. No technical choice or specific design approved; no implementation started.                                                                                                                                                                                                                                       |
| 2026-09-29 | Performative UI and resume capability planning           | Reviewed public docs/manifest and dashboard; editor sign-in prevented full behavior inspection. Added integration and contextual editing contracts, updated all existing Markdown documents, recorded U01–U04 and D13/D14, and paused visual concepts. Development remains unauthorized; checks below record documentation evidence only.                                                               |
| 2026-09-29 | Background components and signed-in editor follow-up     | Recorded U05; inspected background/surface docs and the authorized Chrome editor. One AI suggestion was triggered by Improve with AI and canceled without Accept/Save; original wording remained visible, but the reviewed copy's dashboard update date changed. Observed controls, side effects and untested actions are distinguished in the integration document. No project implementation started. |
| 2026-09-29 | Comprehensive resume capability follow-up (U06)          | Inspected dashboard menus and detailed template/format controls without new generation or saved changes. Added coverage register, proposed F19/F20/Phase 6, expanded F07/F08/F10/F11, and synchronized data/API/privacy/render contracts. No development authorized.                                                                                                                                    |

| 2026-09-29 | Project naming and GitHub preparation (U07) | Renamed project documentation, planned root and package namespace to resume-forge; added .gitignore for local/generated files. All 50 project Markdown files remain eligible to commit. Local directory unchanged; no repository created or push performed; development remains unauthorized. |

## Future update format

Record date, phase/feature, completed slice and paths, actual check commands/manual evidence, failures/limitations, decisions changed, and next action. Keep implementation checkboxes/status untouched until the corresponding work is performed and verified.

## Deferred backlog

Additional templates/format controls and file intake are now proposed Phase 6 F20/F19. Cover letters and arbitrary template-code authoring remain unallocated. Billing's future scope is undecided. Recruitment workflows remain excluded. No implementation progress is assigned to these items.

## 2026-09-29 documentation verification

Checks run: `python3 /private/tmp/verify-resume-context.py` (standard-library Markdown/contract audit) and `rg --files --hidden -g '!.git/**' -g '!.codegraph/**'` (workspace inventory).

| Check                     | Result                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Document inventory        | 50 Markdown files: prior 46 plus capability register, F19/F20 and Phase 6                                                                                                                                                      |
| Local links and structure | 321 local links resolve after U06 follow-up; anchors checked; code fences balanced                                                                                                                                             |
| Roadmap and status        | 20 sequential feature specs, all Not started; all Phase 1–6 implementation tasks unchecked; Phase 6 proposed                                                                                                                   |
| Permission fidelity       | 27 canonical identifiers, exact match to the source permission catalog                                                                                                                                                         |
| Requested requirements    | Performative UI prompts/backgrounds/surfaces/accents, selected-section prompting, review/apply, proposed basic builder, paused concepts, U06 full capability mapping, D13/D14 and proposed Phase 6 reflected in dependent docs |
| Reference evidence        | Public research plus signed-in Chrome section editor, AI suggestion/cancel, ATS/JD and template controls; save/restore/export, mobile/accessibility behavior, algorithm quality and credit usage unverified                    |
| Development boundary      | Workspace inventory contains documentation plus the user-requested .gitignore outside existing tool metadata; no installs, app configs, migrations or application tests/builds                                                 |

Earlier 43-file results describe the prior baseline. At the time of that verification, approval was pending. The later user confirmation recorded below supersedes that historical status.

## Naming and ignore verification — 2026-09-29

Verified the updated Markdown links/statuses with `python3 /private/tmp/verify-resume-context.py`. Checked the proposed package namespace and absence of old project branding in project Markdown. Validated `.gitignore` with `git check-ignore --no-index --stdin` in an isolated temporary Git repository: all 50 project Markdown paths and `.gitignore` remain eligible; representative secrets, generated files and local metadata are ignored; sanitized environment examples and `pnpm-lock.yaml` remain eligible. The project itself was not initialized as a Git repository.

## User confirmation and starter prompts — 2026-09-29

The user said "I confirm everything" and requested prompts for starting with Performative UI. Context review is complete and the planning baseline is accepted. Earlier awaiting-review/no-development statements describe the prior stage; they must not cause a repeated request for overall context approval. This turn prepares prompts only: no dependencies, scaffolds or application code were created. Begin actual work when the user submits an implementation task, starting with P1.1 and then P1.2/F01. Unspecified credentials, provider/model settings, deployment choices and compatibility results cannot be inferred from approval; handle them only when their dependent work needs them. Visual concept exploration remains paused.

## P1.1 implementation — 2026-09-29

| Date       | Work                           | Result / boundary                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-29 | P1.1 toolchain and scaffold    | Verified current registry versions, created pnpm/Turborepo workspace with 5 packages (`@resume-forge/shared-types`, `@resume-forge/shared`, `@resume-forge/shell`, `@resume-forge/gateway`, root). Validated D13 Performative UI compatibility. All build/lint/typecheck pass. Dev servers verified at ports 3000/4000.                            |
| 2026-09-29 | P1.2 shared UI and shell (F01) | Implemented `@resume-forge/shared` design tokens, accessible primitives, workspace patterns, Performative UI wrappers, `@resume-forge/shell` Module Federation host, and three federated remotes (`@resume-forge/auth-mfe`, `@resume-forge/profile-mfe`, `@resume-forge/resume-mfe`). All 7 workspace packages pass `pnpm build` and `pnpm check`. |

### Pinned versions (verified against npm registry)

| Package                 | Documented | Installed | Note                                                    |
| ----------------------- | ---------- | --------- | ------------------------------------------------------- |
| Node.js                 | ≥22        | 22.18.0   | ✅                                                      |
| pnpm                    | latest     | 12.6.0    | ✅                                                      |
| Turborepo               | latest     | 2.11.5    | ✅                                                      |
| TypeScript              | strict     | 5.9.3     | ✅ (doc said "Prisma 7", not "TS 7")                    |
| Vite                    | 6          | 6.4.3     | ✅                                                      |
| React                   | 19         | 19.3.0    | ✅                                                      |
| React Router            | v7         | 7.6.0+    | ✅ v7 range                                             |
| Hono                    | latest     | 4.7.0+    | ✅                                                      |
| Tailwind CSS            | v4         | 4.3.3     | ✅ Installed with `@tailwindcss/vite` in P1.2           |
| @module-federation/vite | latest     | 1.22.1    | ✅ Installed in shell + 3 remotes in P1.2               |
| performative-ui         | 0.7.0      | 0.7.0     | ✅ Pinned and wrapped in `@resume-forge/shared` in P1.2 |

### Check evidence

| Check                                            | Command                                                                                  | Result                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clean install                                    | `pnpm install`                                                                           | 8 workspace packages linked (`pnpm-lock.yaml` updated), 0 errors                                                                                                                                                                                                   |
| Full build (P1.2)                                | `pnpm build`                                                                             | 7/7 packages pass (`shared-types`, `shared`, `gateway`, `shell`, `auth-mfe`, `profile-mfe`, `resume-mfe`)                                                                                                                                                          |
| Full lint + typecheck (P1.2)                     | `pnpm check`                                                                             | 16/16 tasks pass (`eslint` strictTypeChecked + `tsc --noEmit`), 0 errors                                                                                                                                                                                           |
| Production federation & CSS audit                | `node` verification script                                                               | `dist/remoteEntry.js` built for all 3 remotes with shared singletons (`react`, `react-dom`, `react-router`, `@resume-forge/shared`); `packages/shared/dist/styles.css` verified                                                                                    |
| Direct `performative-ui` import audit            | `git grep "performative-ui" apps/`                                                       | 0 direct imports in `apps/*`; all remotes consume wrappers via `@resume-forge/shared`                                                                                                                                                                              |
| Dev server federation & `optimizeDeps` fix (E06) | Vite middleware crawl (`shell` + `auth-mfe` + `resume-mfe`)                              | `shareStrategy: "loaded-first"`, `hostInitInjectLocation: "entry"`, and `optimizeDeps.include: ["lucide-react", "@resume-forge/shared > performative-ui"]` verified; 0 mid-flight re-optimizations                                                                 |
| Live Chrome DevTools MCP audit (E07, E08)        | Chrome DevTools MCP (`navigate_page`, `click`, `list_console_messages`, `take_snapshot`) | Verified `/w/ws-personal-01/resumes/new`, `/w/ws-personal-01/resumes/res-draft-01`, `/w/ws-personal-01/profile`, and `/sign-in`; verified `Simulate Remote Failure` + `Retry loading resume-mfe` recovery; `0` console errors, `0` warnings, `0` form-field issues |
| Gateway health                                   | `curl localhost:4000/api/v1/health`                                                      | `{"data":{"status":"ok",...}}`                                                                                                                                                                                                                                     |
| Shell dev server                                 | `curl localhost:3000`                                                                    | HTML served with React entry                                                                                                                                                                                                                                       |

See [error-and-fix-log.md](error-and-fix-log.md) for all errors encountered across P1.1–P1.2 (`E01`–`E08`), their root causes, and fix verification status.

### Version deviation from architecture-context.md

The documented stack lists "Prisma 7" — this is the Prisma ORM version (to be installed in P1.3), not TypeScript 7 (which doesn't exist). TypeScript 5.9.3 is the current latest stable. No other stack deviations were necessary.

## F01 usability refinement — 2026-09-29

User requested a product-quality UI/UX review before continuing. Reopened the incomplete visual/interaction acceptance of P1.2: separate creation/editor routes, a focused workspace shell, mobile navigation and editor views, readable document layout, consistent shared CSS, and honest sample-state labels. P1.3 is not dependency-ready while D03/D04/D08/D11 and the database target remain unresolved. Verification completed on 2026-09-30; see [design review](../docs/ui-redesign-review.md).

### Actual completion evidence — 2026-09-30

- Inspected existing working tree and retained the implemented redesign; finished remaining production-browser checks and a tablet wordmark correction.
- `pnpm build`: 7/7 pass (5 fresh, 2 cached). `pnpm check`: 16/16 pass (10 fresh, 6 cached).
- Production modules loaded; creation radio keyboard control, required-role validation, profile validation/reset, mobile section focus, light/dark document isolation and synthetic failure/retry verified.
- Desktop 1280px, tablet 800px, mobile 390px visually reviewed; library/create measured without horizontal overflow at 320px.
- Fixed missing shared Tailwind app-source utilities/cache dependencies, clipped mobile creation action, tablet branding wrap and misleading simulated saved/AI states. Diagnostics moved under Preferences.
- Normal production flows produced no console errors/warnings; intentional diagnostic failure logged its expected error and recovered. Vite's existing federation `vm` externalization build warning remains.
- Updated README run steps, UI context, D06 implementation note, phase/spec notes and error log. Installed/applied the frontend-design skill; no additional backend features marked complete.
- P1.3 and real sign-in/persistence/AI/PDF remain pending. Review limits and screenshots are in the linked verification record.

## P1.3 personal access foundation — 2026-09-30

- Added `@resume-forge/access-policy` as a server-side package with the approved 27 permission identifiers and no unresolved role mapping.
- Implemented authoritative personal workspace/resource scope checks. Client-selected workspace IDs are treated as untrusted selectors and mismatches deny access.
- Added nine Node tests covering the allowed owner path, exact permission catalog, missing authentication, cross-user ownership, selector spoofing, inactive shared-workspace types, cross-workspace resources, cross-user resources and malformed identifiers.
- Added the root `pnpm test` task using the installed Turborepo 2.11.5 task contract.
- Verification: `pnpm --filter @resume-forge/access-policy build`, package test/lint/typecheck, `pnpm check` (18/18), `pnpm build` (8/8), and `pnpm test` (9/9 tasks; 9/9 policy cases) passed.
- Scope boundary: no Prisma schema, migration, database fixture, private route, session model, role bundle, audit outbox or vector column was implemented. F03 remains in progress.

## P1.3 audit-intent contract foundation — 2026-09-30

- Added `@resume-forge/audit-contracts` with the 22 documented base/proposed event names and typed workspace/resource/outcome contracts.
- Added runtime validation for attributable actor/workspace/resource scope, opaque bounded IDs, canonical UTC timestamps, action/resource compatibility and denied/failed outcome semantics.
- Metadata accepts only 11 named identifier/status keys, at most eight entries, with the canonical 27-name permission vocabulary. Unknown keys, nested data, raw text, email-like values and URLs fail validation.
- Added 12 Node tests covering accepted events and privacy/schema failures.
- Verification: package build/lint/typecheck/test passed; `pnpm check` passed 21/21 tasks, `pnpm build` passed 9/9 packages, and `pnpm test` passed 11/11 tasks with 21/21 policy/contract cases.
- Scope boundary: this package returns a sanitized event intent only. D11 still gates transactional outboxes, retry/idempotent ingestion, sensitive-read failure policy, retention/deletion and the Phase 4 viewer.

## P1.3 local identity persistence — 2026-09-30

- User selected local PostgreSQL only and approved all four recommended schema designs (D03/D04/D08/D11 durability). Production hosting and retention remain deferred.
- Added pinned Prisma 7.10.0/client/adapter-pg, generated server-only client, reviewed initial SQL migration, and project-local SCRAM-authenticated PostgreSQL scripts on loopback port 55432. Runtime data and credentials are ignored.
- Implemented User/OAuthAccount/Session/Workspace/UserProfile/UserContact/ProfileWorkspaceGrant with unique identities, owner-attributed grants, restrictive foreign keys and explicit SQL CHECK constraints.
- `pnpm db:migrate`: initial migration applied on PostgreSQL 18.3. `pnpm db:test`: 7/7 database subtests plus parent passed, covering scopes, constraints, revocation, separate contacts, rollback via independent connection and synthetic backup/restore. Fixtures and restore databases are disposable; no production database was contacted.
- Remaining: service repositories/roles, OAuth/session behavior, vectors and private UI integration. F03 remains in progress. See [database notes](../docs/database-foundation.md) for limits.

- Regression verification: `pnpm check` passed; `pnpm test` passed 12/12 tasks (all 10 package builds and 21 existing policy/audit test cases). New client generation/build/typecheck passed; Node syntax checks and `git diff --check` passed. Database credentials and generated client source confirmed ignored.
- Local stop/start preserved the database; repeating `pnpm db:migrate` reported no pending migrations. The final `pnpm db:test` command rebuilt the client and again passed all seven subtests plus parent. PostgreSQL remains running for manual checks. Initial sandbox shared-memory restriction was resolved by authorized local execution; no outstanding database test failure.

## P1.3 profile, task, and audit extensions — 2026-09-30

- Implemented profile section tables (Education, Experience, Skill, UserProject, Certification) connected to UserProfile.
- Implemented typed workspace dependencies (Organization, Vendor, WorkspaceMembership).
- Added version and task persistence foundations (JDHistory, Resume, ResumeVersion, TaskRun).
- Added audit storage models (AuditEvent, AuditOutbox); this is not evidence of implemented durable capture or delivery.
- Verified Prisma format, generated client, and migration integrity via local database tests (`pnpm db:test` and `pnpm check` passed).

## P1.4 Google sign-in and local sessions — 2026-10-01

- Inspected and retained existing uncommitted profile/task/audit migration and auth scaffold; corrected the scaffold instead of rebuilding completed identity persistence.
- Fixed root `.env` loading, local database fallback, backend GET callback routing, credentialed OAuth-cookie fetch, real Google code exchange and userinfo validation. Removed the fabricated Google identity path and raw error logging.
- Added expiring browser-bound single-use state with PKCE, transactional provider identity/workspace provisioning without email merging, hashed rotating refresh credentials, five-minute access credentials, Origin checks, minimal identity response and logout/replay revocation. No OAuth-created master profile.
- Added visible failure/retry/session-success/logout states; LinkedIn is explicitly disabled. Full shell protection and onboarding are not implemented by this slice; F02 remains in progress.
- `pnpm --filter @resume-forge/auth-service test:db`: seven integration subtests plus parent passed against disposable PostgreSQL databases using a synthetic provider. `pnpm check` and `pnpm test` passed (13 build/test tasks; 21 existing contract cases). New auth lint is included in root checks.
- Browser verified sign-in controls and handoff to Google. Google returned `invalid_client`; both configured Google fields had client-secret format. Added a fail-fast client-ID format guard to prevent sending a secret as public client ID. User must set the actual ID, rotate the exposed secret and register the exact backend redirect. No successful real-provider login claimed.
- Corrected the earlier durable-audit completion claim: models exist, capture/retry/ingestion behavior is pending. Existing migration changes remain intact. Local auth is intentionally not production-ready; see [Google setup and boundaries](../docs/google-login.md).

- Follow-up: user updated credentials; a value-safe check confirmed valid client-ID format and a configured secret. Restarted local auth and verified HTTP 200, Google origin, S256 PKCE and exact backend redirect. Seven auth integration subtests plus parent passed again after the format guard. Frontend build scan found no configured Google secret. Google Console callback registration and successful consent/login still require manual verification.

## P1.4 shared browser sessions — 2026-10-01

- Started from clean commit `9eabc96`; preserved the completed Google server flow.
- Recorded LinkedIn implementation on hold pending credentials. Disabled button now explains this prerequisite.
- Added one shared, Zod-validated session controller used by shell and auth MFE. Restores session on mount, revalidates on focus/every 60 seconds, and keeps access credentials private in memory.
- Web Locks serialize refresh/logout across same-origin tabs; BroadcastChannel carries only logout invalidation, never credentials or identity. Unsupported Web Locks fail closed. Tabs receiving logout stay cleared until a new page/sign-in; failed server logout exposes a retry instead of claiming successful revocation.
- Generation checks prevent late in-flight identity responses restoring signed-out state. Shell account status reflects the server session while retaining the sample-workspace label. Route subtree remounts on identity/status changes to clear mounted drafts/selections.
- Seven deterministic controller tests cover deduplication, serialization, revoked identity, outage/malformed response recovery, late response rejection, logout failure/retry, and unsupported locking. Browser multi-tab Google testing remains a manual check.
- Scope boundary: this is session bootstrap/coordination, not completion of F02 protected routes, onboarding, account linking, or later private resume operations.

- Final verification: `pnpm check` passed 25/25 tasks; `pnpm test` passed 14/14 tasks (all workspace builds plus 28 controller/policy/audit cases). `git diff --check` passed. Live browser restored an existing authenticated session in two tabs, with matching account status, the sample-workspace boundary, and disabled LinkedIn credential-waiting label. This verifies restoration, not a fresh Google consent round-trip. Cross-tab logout against the live account was left for manual verification; deterministic tests cover invalidation and stale-response races.
