# Progress Tracker

**Last updated:** 2026-10-02

**Current stage:** Phase 1 in progress — P1.1/P1.2 complete; P1.3 local persistence/capture/retry/HTTP transport/runtime roles verified; P1.4 Google/local sessions, browser coordination and protected personal routing implemented.

**Context approved by user:** Yes — 2026-09-29 ("I confirm everything").

**Development authorized:** Active — P1.1 and P1.2 (F01) complete; P1.3 (F03) in progress.

**Implementation completed:** 1 of 20 features complete (F01 Design system verified; F19/F20 allocated to proposed Phase 6).

Current review: [comprehensive capability coverage](resume-capability-coverage.md), proposed [Phase 6](build-plans/06-builder-expansion.md), [Performative UI integration](frontend-integration.md) and [contextual resume editing](resume-editing-contract.md), requested on 2026-09-29. The same-day follow-up includes suitable backgrounds/surfaces/accents and signed-in Chrome editor findings. Visual concepts are paused. The selected library and interaction direction are recorded; detailed contracts and unrelated foundation decisions remain under review.

This is the canonical status file. [project-tracker.md](../project-tracker.md) links here rather than duplicating progress.

## Current goal

Complete Phase 1 Foundation. P1.1 toolchain/scaffold and P1.2 shared UI/shell (F01) are complete. P1.3 personal-scope policy, audit-intent validation, local persistence migrations, atomic capture and local audit retry/ingestion are verified. Automatic scheduling/production identity and private-route integration remain pending; local service DB authorization is verified; vectors remain gated by D07.

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

| ID  | Phase      | Feature/spec                                                           | Context      | Implementation                                                                     | Verification                                                                                                                                            |
| --- | ---------- | ---------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | 1          | [Design system](feature-specs/01-design-system.md)                     | Spec drafted | **Complete (P1.2)**                                                                | **Passed** (`pnpm build`, `pnpm check`, production federation & CSS token audit)                                                                        |
| F02 | 1          | [Google + LinkedIn OAuth](feature-specs/02-auth-oauth.md)              | Spec drafted | Google/local sessions and protected personal routing implemented; LinkedIn on hold | Auth/session tests plus 8 routing cases pass; live scope denial/setup/outage recovery verified; fresh Google consent pending                            |
| F03 | 1          | [Database schema + Prisma](feature-specs/03-database-schema.md)        | Spec drafted | **In progress (P1.3 persistence)**                                                 | 21 policy/contract tests; local migration plus 12 database subtests and parent passed                                                                   |
| F04 | 1          | [Individual profile wizard](feature-specs/04-profile-wizard.md)        | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F05 | 2          | [JD parser](feature-specs/05-jd-parser.md)                             | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F06 | 2          | [Resume generator + suggestions](feature-specs/06-resume-generator.md) | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F07 | 2          | [ATS scoring + breakdown](feature-specs/07-ats-scoring.md)             | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F08 | 2          | [Resume builder + preview](feature-specs/08-resume-preview.md)         | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F09 | 3          | [PDF export + R2](feature-specs/09-pdf-export.md)                      | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F10 | 3          | [Resume dashboard](feature-specs/10-resume-dashboard.md)               | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F11 | 3          | [JD history](feature-specs/11-jd-history.md)                           | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F12 | 3          | [Profile editor](feature-specs/12-profile-editor.md)                   | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F13 | 4          | [Workspace management](feature-specs/13-workspace-management.md)       | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F14 | 4          | [RBAC + privacy](feature-specs/14-rbac-privacy.md)                     | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F15 | 4          | [Audit logging](feature-specs/15-audit-logging.md)                     | Spec drafted | Phase 1 capture and local retry/ingestion implemented                              | 12 contract tests, 5 capture cases and 9 local delivery subtests pass; local HTTP transport verified; scheduling/roles/route integration/viewer pending |
| F16 | 5          | [LinkedIn data import](feature-specs/16-linkedin-import.md)            | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F17 | 5          | [Keyword gap analysis](feature-specs/17-keyword-gap-analysis.md)       | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F18 | 5          | [MCP integration](feature-specs/18-mcp-integration.md)                 | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F19 | 6 proposed | [Existing resume file import](feature-specs/19-resume-file-import.md)  | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |
| F20 | 6 proposed | [Template customization](feature-specs/20-template-customization.md)   | Spec drafted | Not started                                                                        | Not run                                                                                                                                                 |

## In progress

**P1.3 — Persistence and access foundations (F03) (in progress).** Added `@resume-forge/access-policy` with the exact 27-name capability vocabulary and fail-closed personal ownership/scope decisions. Added `@resume-forge/audit-contracts` with the 22 documented event names, authoritative actor/workspace/resource fields, explicit outcomes, canonical UTC timestamps and allowlisted identifier/status metadata. Raw content, unknown keys, URLs, emails, nested values and action/resource/outcome mismatches are rejected. Local persistence/grant models, session rotation, atomic personal capture and local retry/ingestion are implemented. Shared-workspace routes, role bundles, automatic audit scheduling/production identity and private-route integration of sensitive-read enforcement remain pending.

## Decisions awaiting review

See [decisions.md](decisions.md) for proposed options and exact boundaries.

| Decision group               | IDs                                                                               | Effect                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Original product questions   | D01 billing; D02 vendor consent                                                   | Billing can remain future scope; vendor consent flow remains Phase 4; D03 approved                 |
| Foundation design            | D11 retention/deletion periods (durability approved)                              | D03/D04/D08 and D11 durability approved 2026-09-30; retention required before real-data deployment |
| AI and content               | D07 embedding dimensions/model; D09 ATS rubric; D12 contact-safe rendering/export | Resolve before vectors, scoring, and content/artifact contracts                                    |
| Shared policy and operations | D05 full role grants; D10 hosting/domains/invitations                             | Resolve before affected integrations and shared release                                            |
| Additional intake            | D14 PDF/DOC/DOCX resume import                                                    | F19 in proposed Phase 6; formats/parser/limits/retention remain open before implementation         |

## Next step

Protected personal shell routing is verified. Authenticated local audit transport is verified. Restricted local runtime roles and service DB authorization are verified. Next unblocked slice: automatic local audit relay scheduling with bounded runs and shutdown/recovery verification. Private profile persistence still requires actor/resource authorization and route capture integration. Keep D05 shared-role activation and D11 retention boundaries open; do not enable shared workspaces or claim a completed onboarding wizard. LinkedIn stays **on hold by user request, awaiting credentials/configuration**. F02/F03/F15 remain in progress.

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

## P1.3 atomic personal audit capture — 2026-10-01

- Committed the previously verified shared-session slice as `d0def17` at the user's request. This new slice remains uncommitted for review.
- Checked onboarding dependencies and chose atomic audit capture before exposing private profile/contact persistence. LinkedIn remains on hold.
- Added `withPersonalAuditTransaction` in the server-only Prisma package. It validates/prunes audit intent, binds the supplied authenticated actor to the personal workspace/target, executes scoped caller work, and inserts the pending outbox intent in one transaction. Return values are released only after successful commit.
- Invalid metadata/scope rejects before domain work; domain errors and duplicate event IDs roll back. Duplicate IDs are not treated as successful mutation replay. Service callers still own authentication, permission/resource checks and side-effect-free scoped queries.
- Added five real PostgreSQL cases, including an independent observer and a deferred trigger failing at COMMIT to prove contact-read results are withheld on audit failure and recover afterward. No private route, delivery worker, audit viewer or retention process was enabled.
- Final verification (2026-10-02): `pnpm db:test` passed all 12 subtests plus parent (13/13), including migration, isolation, audit commit/rollback and synthetic backup/restore in disposable local databases. The preceding verification logs confirm `pnpm check` passed 26/26 tasks and `pnpm test` passed 14/14 tasks with 28 controller/policy/contract cases; those completed checks were not repeated during resume.
- Fixed a concurrent Prisma generation failure (`EEXIST`) by generating in the package build only, making its Turborepo typecheck depend on that build and caching generated output. No dependency versions changed.
- Targeted `pnpm exec prettier --check` passed for the changed Prisma source/test/package/Turborepo files; `git diff --check` passed.
- Local verification: run `pnpm db:local:start`, then `pnpm db:test` from the project root; expect 13 passes, zero failures, including the contact COMMIT-failure/recovery case. This slice adds no new UI flow.

## P1.3 local audit delivery and ingestion — 2026-10-02

- Preserved the completed, uncommitted atomic-capture work; selected the next D11-approved slice without rebuilding auth/session behavior. No commit or push was requested for this turn.
- Added an additive audit migration: durable attempt/backoff/lease/acknowledgement fields and state constraints/indexes on AuditOutbox; nullable outcome/correlation/hash fields on legacy AuditEvent history. New ingestions require complete validated intent and use the producer event ID as ledger identity.
- Added producer-side `deliverAuditOutbox` with bounded atomic claims, 30-second leases, stale-owner fencing, persisted exponential retry (5 seconds to 5 minutes), fixed error codes and retained blocked intents. Domain mutations are never replayed by delivery.
- Added workspace-owned `ingestPersonalAuditEvent`: validates personal scope, preserves occurrence time/outcome/correlation, deduplicates equivalent events and rejects conflicting ID reuse without updating history. No shared-workspace or HTTP route is activated.
- Added `pnpm audit:deliver:local` for one batch in the managed local database only and `pnpm db:test:audit` for disposable synthetic verification. The runner prints counts/backlog only and leaves scheduling/manual remediation explicit.
- Verification: `pnpm db:test:audit` passed 9 subtests plus parent (10/10), including outage/backoff recovery, lost acknowledgement, concurrent claims/ingestion, expired lease/stale completion, malformed/spoofed scope, conflicting payload and acknowledgement COMMIT failure. `pnpm db:test` passed 12 subtests plus parent (13/13), retaining capture rollback/contact failure and backup/restore checks.
- `pnpm db:migrate` applied `202610020001_audit_delivery` to local PostgreSQL successfully. The local runner completed with zero claimed/delivered/retried/blocked/stale events because the development queue was empty; synthetic tests cover nonempty delivery.
- `pnpm check` passed 27/27 tasks; `pnpm test` passed 15/15 tasks with the existing 28 policy/contract/controller cases. Workspace-service and its dependency builds passed. Frozen-lockfile installation reused 443 packages with zero downloads; existing dependency versions remain unchanged.
- Targeted Prettier verification and `git diff --check` passed. The final local runner printed an empty pending/delivering/blocked backlog with exit code 0. README/database notes include the new commands and expected results.
- Remaining: authenticated cross-service transport, automatic scheduling, least-privilege/append-only runtime roles, service route coverage/denied-event capture, shared-workspace ingestion, viewer and retention. Local retry foundations do not complete F03/F15 or authorize real-data deployment. LinkedIn remains on hold.
- Manual checks: `pnpm db:test:audit` should show 10 passes, zero failures; `pnpm audit:deliver:local` should print summary/backlog counts, all zero on an empty queue. No new UI is added. See [database notes](../docs/database-foundation.md).

## P1.4 protected personal shell routing — 2026-10-02

- Preserved all completed audit/session work and selected the independently unblocked browser-routing slice. Reused the frontend-design skill and existing shared surfaces/typography for recovery/denial/setup states; no new visual system or dependency upgrade.
- Replaced the hardcoded workspace selector with `/auth/me`'s validated personal workspace ID. Anonymous/loading/error states cannot mount workspace or onboarding children. Wrong workspace URLs render a denial with a safe return path; inactive shared workspaces receive no browser access.
- Added actor+workspace route keys to clear mounted drafts/selections on scope/status changes. Signed-out navigation no longer offers a guest workspace bypass. This remains browser navigation only; private APIs still require independent backend authorization.
- Root and successful OAuth handoff follow server onboarding status. Incomplete users see an authenticated setup-pending entry with an explicit protected sample-workspace link; completed users enter their personal workspace. Return URLs are ignored and callback errors are not hidden by conflicting success flags. No profile creation/save or fabricated completion state.
- Verification: 8 shell routing tests passed, including actual nested guard rendering with child mount counts, spoofed selectors, session outage/recovery/logout, scope reset keys, safe callback handoff and honest setup entry. `pnpm check` passed 27/27 tasks; `pnpm test` passed 16/16 tasks with 36 policy/contract/controller/routing cases. Shell/auth MFE lint/typecheck and production builds passed; targeted Prettier and `git diff --check` passed.
- Live production-browser evidence: existing local session restored; old preview selector was denied; root entered the incomplete setup screen; its protected sample link opened the authoritative workspace. Auth stop/reload replaced content with recovery; restart plus retry restored the workspace. A 390px viewport denial check showed no horizontal overflow. Account/profile data were not copied into fixtures or documentation. A clipped content-only screenshot is saved at `/tmp/resume-forge-protected-route.jpg`.
- Limits: no fresh Google consent, live anonymous/logout round-trip or completed-user browser account was exercised; tests cover those routing states. Standalone remotes remain synthetic previews. Existing federation `vm` externalization warning remains nonfatal. Auth service was restarted for verification and remains available on localhost:4001. Changes remain uncommitted.
- Manual checks: follow [protected-routing steps](../docs/google-login.md). Use a private/signed-out window for redirects; verify your workspace UUID and denial after changing it; verify cross-tab sign-out removes protected content. Persisted onboarding, private profile/resume APIs, authenticated audit transport and runtime privileges remain pending.

## P1.3 authenticated local audit transport — 2026-10-02

- Committed the previously completed capture/relay/ledger and protected-routing work as `4e75e28` (`feat: add durable audit foundations and protected workspace routing`). No push was requested or performed. The new transport slice remains uncommitted for review.
- Added workspace-service `POST /internal/audit/events`, authenticated before parsing/DB access with a single allowed local service identity and a randomly generated 256-bit server-only credential. The recipient binds only to 127.0.0.1:4005, has no CORS, rejects browser Origin requests, and is not forwarded by the gateway.
- Added a server-only HTTP adapter used by the existing local operator relay: loopback-only URL, no redirects/URL credentials, 3-second timeout, bounded validated acknowledgement matching event ID, safe fixed error codes and retry on rejected credentials/unavailability. The route strictly rejects unknown top-level fields as well as private/unknown metadata, malformed JSON, unsupported content type and actual request bodies over 16 KiB. Replies are bounded to 1 KiB.
- Ledger success is acknowledged only after COMMIT. Equivalent HTTP retries converge; conflicting IDs/scope are rejected without altering history. The 25-event operator batch uses a 120-second lease to cover bounded transport waits and retains existing stale-owner fencing. No producer domain operation is replayed.
- Added `audit:local:init` (ignored credential file, mode 0600, repeated setup preserves the key) and `audit:serve:local`. Both recipient and relay read ignored local configuration directly, reject production mode and ignore hosted/root/process database overrides. Production credential distribution/rotation/HTTPS policy remains deferred under D10.
- Verification: frozen-lockfile install passed using already locked Hono 4.13.10, Node adapter 1.19.17 and Zod 3.25.76; no package versions upgraded. Service/dependency builds passed. `pnpm --filter @resume-forge/workspace-service test` passed 8/8 transport cases. `pnpm db:test:audit` passed 11 subtests plus parent (12/12), including HTTP retry after invalid credentials/lost acknowledgement and a deferred ledger COMMIT failure that withholds success and recovers without losing the producer mutation.
- Regression verification: `pnpm check` passed 27/27 tasks; `pnpm test` passed 17/17 tasks (existing 36 policy/contract/controller/routing cases plus 8 transport cases); `pnpm db:test` passed 13/13 including capture/contact COMMIT failure, migration/rollback and backup/restore. Logs: `/tmp/resume-forge-audit-http-check.log`, `/tmp/resume-forge-audit-http-test.log`, `/tmp/resume-forge-audit-http-db.log`.
- Targeted Prettier checks and `git diff --check` passed. The ignored local credential file has mode 0600; no credentials or generated database files enter the Git diff.
- Live local smoke checks: generated the ignored key, started the recipient, confirmed credential-free POST returns HTTP 401 with `service_unauthorized`, repeated setup kept the key, and the relay exited 0 with an empty backlog. The empty development queue exercised no HTTP event transfer; nonempty transfer/recovery is verified in disposable synthetic database tests. The verification recipient was stopped afterward.
- Issue found and fixed: the existing intent validator normalizes away unknown top-level fields; the new HTTP Zod boundary rejects them before normalization. Existing in-process contract behavior was preserved. Request/error payloads and credentials are never printed or persisted as diagnostic messages.
- Manual verification: follow [database notes](../docs/database-foundation.md): start local PostgreSQL, initialize the key, keep `pnpm audit:serve:local` running in a separate terminal, check credential-free curl receives 401, then run the relay/transport/database commands. Expect 8 transport and 12 audit database passes, zero failures; no new UI flow.
- Pending: restricted runtime DB roles/service authorization (next), automatic scheduling, private-route integration and denied-event capture, production service identity/network policy, shared-workspace ingestion, viewer and retention. F02/F03/F15 remain in progress; LinkedIn stays on hold awaiting credentials. Do not claim private-data deployment readiness or completed onboarding.

## P1.3 restricted local runtime roles — 2026-10-02

- Committed the completed local audit HTTP slice as `af0ae6f` (`feat: authenticate local audit delivery`); no push performed. This new role slice remains uncommitted for review.
- Added a versioned service grant matrix and transactional, idempotent local operator provisioning. Distinct auth/profile/relay/ingestor passwords are stored only in ignored `.local/runtime-database.env` with mode 0600. Migration and disposable-test administration retain the existing separate local credential. Setup refuses hosted/production targets, unmanaged role-name collisions and unexpected ownership/memberships, with rollback of partial credential/grant changes.
- Normal runtime roles have no object ownership/memberships, superuser/role/database creation/replication/RLS bypass or schema/DDL/TEMP/delete/truncate grants. All normal runtime roles are denied AuditEvent UPDATE/DELETE/TRUNCATE. PUBLIC privileges and migration-owner defaults are revoked; future tables/functions do not gain automatic service access. Reapplication removes separately granted column ACLs as well as table grants.
- Added runtime startup/delivery verification of actual role attributes, membership/ownership, effective table AND column ACLs, grant options, routines and sequences. Auth and audit runners read only their fixed local runtime URLs and fail closed without a root/process DATABASE_URL administrative fallback. HTTP service authentication remains independent.
- Narrowed `/auth/me` to the onboarding field from UserProfile; auth cannot read professional/contact content. Changed capture to non-returning `createMany` so the profile producer needs only INSERT on AuditOutbox, preserving atomic rollback/duplicate failure and COMMIT-gated contact results. Relay can update delivery fields only; ingestion can insert ledger events and read id/hash only for deduplication. Profile section/contact storage rights do not expose a private API or activate shared-workspace roles.
- Verification: `pnpm db:test:roles` passed 9 subtests plus parent (10/10). Separate restricted connections completed capture→relay→real authenticated HTTP→ledger ingestion and duplicate retry; denied unrelated tables/columns, history alteration and administrative SQL; retained spoofed-scope/duplicate rollback and fail-closed contact reads under a deferred COMMIT failure; verified future-object denial, column-grant drift/reprovisioning and transactional password rollback/collision rejection. Disposable databases and temporary roles were removed afterward.
- `pnpm --filter @resume-forge/auth-service test:db` passed 7 subtests plus parent (8/8) with the main app using the restricted auth connection. `pnpm db:test` passed 13/13, `pnpm db:test:audit` passed 12/12, `pnpm check` passed 27/27 tasks and `pnpm test` passed 17/17 tasks (44 existing routing/policy/contract/controller/transport cases). No dependency versions or lockfile changed. Logs: `/tmp/resume-forge-runtime-{roles,auth,db,audit}-test.log`, `/tmp/resume-forge-runtime-check.log`, `/tmp/resume-forge-runtime-test.log`.
- Targeted Prettier verification and `git diff --check` passed. Confirmed `.local/runtime-database.env` is ignored by Git and has mode 0600.
- Applied verified role setup to the managed local development database; repeated setup succeeded. Live smoke: temporary restricted auth started on port 4101, `/auth/me` returned 401 without credentials, Google initiation returned 200; restricted audit ingestion started on 4005 and credential-free POST returned 401. Restricted relay printed an empty backlog (nonempty delivery is proven in synthetic tests). Both temporary verification servers were stopped. The existing auth watcher had stopped during the configuration transition; it was restarted on 4001 with restricted access after provisioning.
- Manual check: run `pnpm db:runtime:init`, restart `pnpm dev`, then run `pnpm db:test:roles` (expect 10 passes). Follow [runtime role notes](../docs/runtime-database-roles.md) for audit startup/401/relay checks. Existing Google/session UI should behave as before; fresh Google consent remains manual. No new UI flow is introduced.
- Boundaries: these grants enforce service table/column responsibilities, not per-user row-level security. Private use cases still require actor/action/resource authorization and scoped queries. Auth-owned personal workspace bootstrap remains an existing local exception pending extraction. Hosted role provisioning/identity, automatic relay scheduling (next), private profile routes and denied-event coverage, retention and shared-workspace activation remain pending. LinkedIn stays on hold; F03/F15 are not complete.
