# resume-forge

## Current development task

<!-- BEGIN:CURRENT_TASK -->
```json
{
  "status": "idle",
  "task": null,
  "owner": null,
  "startedAt": null,
  "updatedAt": "2026-10-04T19:03:57.920Z",
  "lastResult": "Merged main 9e6157b; API readiness report saved. Next: runtime/lockfile fixes, then personal profile integration. No API implementation or credentials changed."
}
```
<!-- END:CURRENT_TASK -->

The Codex heartbeat checks this task every **15 minutes**. An `ongoing` task is skipped, including a task that takes longer than 15 minutes. When idle, read the [canonical tracker](context/progress-tracker.md), claim one unblocked slice with `pnpm task:start "Short task title"`, retain the returned owner token, and finish with `pnpm task:finish OWNER "Actual result and remaining limitation"`. `pnpm task:status` also checks an atomic ignored `.local/development-task.lock`; a competing start exits 2 without changing the README. Invalid or inconsistent state stops new work. Do not remove a stale lock or overwrite an ongoing marker until the previous run is confirmed stopped. See [scheduled development](docs/scheduled-development.md) for recovery and verification. Keep Codex open and this Mac awake for local checks.

**Frontend update — 2026-10-03:** The sample editor now supports direct paper editing across all six sections, contextual actions, complete local Edit dialogs, empty-only fictional sample autofill and full-draft checkpoints/history. [Manual checks and screenshots](docs/manual-editor-verification.md) explain the reset-on-reload boundary. Real contacts, durable resume versions, AI, ATS and PDF remain pending.

**Frontend fix — 2026-10-04:** Contextual actions are centered below the active section without shifting the resume or covering the next heading; mobile retains its action dock. [Before/after and manual checks](docs/manual-editor-verification.md#toolbar-positioning-correction--2026-10-04).

**AI dialog preview — 2026-10-04:** Improve with AI opens a selected-target dialog with temporary Thinking, Suggested changes and No changes needed states. Accept/Cancel and Undo work locally; every state identifies the disconnected AI service. [Actual checks and manual steps](docs/ai-preview-verification.md). This is frontend-only and resets on reload.

A planned multi-tenant resume and professional-profile platform for individuals, organizations, and vendors. It tailors resumes to supplied job descriptions without changing the master profile.

**Skills update — 2026-10-04:** Languages are grouped inside Skills; click Skills for category/tag editing without an AI toolbar. Extra paragraph spacing is removed. [Verification and manual checks](docs/manual-editor-verification.md#skills-dialog-and-compact-spacing--2026-10-04) record desktop/keyboard results and mobile verification pending. Saves still reset on reload.

**Current stage: Phase 1 in progress — P1.1 toolchain/scaffold and P1.2 shared UI/shell (F01) complete.** Next task: P1.3 persistence and access foundations (F03). The tracker records the current gate and supersedes earlier planning-stage status notes.

**Editor tools — 2026-10-04:** Added Back to all resumes and Edit Content, Customize Template, ATS Score and Optimize for JD panels. Typography/spacing previews share local checkpoints/history; ATS/JD services and PDF remain pending. [Results and manual checks](docs/editor-panels-verification.md).

**Workspace sidebar — 2026-10-04:** Collapse sidebar below the logo folds the first column into a 72px icon rail. Expand restores its labels; mobile keeps the existing navigation menu. The choice resets on reload. [Screenshots and manual checks](docs/workspace-sidebar-verification.md).

## Start here

**Frontend worktree — 2026-10-04:** All new frontend work uses `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2` on `codex/frontend`. The original checkout is retained at detached commit `0dc79ec` for its existing services. Use the new worktree's own task marker/lock. [Current checkout paths and coordination](docs/parallel-development.md).

For frontend-only development in this worktree, install the frozen lockfile, build `@resume-forge/shared-types` and `@resume-forge/shared`, then run:

```bash
pnpm --parallel --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe dev
```

The standalone sample editor is at `http://localhost:3003/`; the shell is at `http://localhost:3000/`. These four frontend servers now run from this worktree. Full-app sign-in is currently blocked by a local auth/profile database-password mismatch recorded in the [tracker](context/progress-tracker.md). Backend credentials and the existing database stay in the original checkout; do not initialize a second cluster or copy secrets into this worktree.


**Parallel development — 2026-10-04:** Current sidebar work is committed on `main`; new work uses `codex/frontend` and a separate `codex/backend` checkout. Codex owns frontend and integration; the backend agent owns assigned service changes. Read [file ownership, scheduler rules and Gemini handoff](docs/parallel-development.md) before running both agents. The frontend AI dialog commit `0dc79ec` was subsequently pushed to `origin/codex/frontend`; the named frontend worktree now owns that branch.

1. [Context index](context/README.md) — reading order and the complete document map.
2. [Project overview](context/project-overview.md) — product scope, five baseline phases and proposed Phase 6.
3. [Build plan](context/build-plan.md) — dependencies, phase gates, and task plans.
4. [Decisions and open questions](context/decisions.md) — confirmed choices, proposed details, and unresolved requirements.
5. [Project tracker](project-tracker.md) — entry point to the canonical progress record.
6. [Agent instructions](AGENTS.md) — rules for future work in this project.
7. [Frontend integration](context/frontend-integration.md) — Performative UI and reference review.
8. [Contextual editing contract](context/resume-editing-contract.md) — section prompts, review/apply and version behavior.

## Documentation layout

```text
resume-forge/
├── AGENTS.md
├── README.md
├── project-tracker.md
├── context/
│   ├── README.md
│   ├── project-overview.md
│   ├── architecture-context.md
│   ├── ui-context.md
│   ├── code-standards.md
│   ├── ai-workflow-rules.md
│   ├── progress-tracker.md
│   ├── frontend-integration.md
│   ├── resume-editing-contract.md
│   ├── phase-1-decision-review.md
│   ├── decisions.md
│   ├── data-model.md
│   ├── authorization-model.md
│   ├── validation-strategy.md
│   ├── build-plan.md
│   ├── build-plans/           # Context review + six phase plans (Phase 6 proposed)
│   └── feature-specs/         # 20 numbered feature specs (F19/F20 proposed additions)
└── docs/
    ├── source-plan.md         # Supplied plan adapted to this project root
    ├── api-reference.md       # Route contracts and implementation boundaries
    ├── deployment.md          # Planned deployment and readiness checks
    └── mcp-integration.md     # Phase 5 integration contract
```

The project and planned GitHub repository are named `resume-forge`. The layout above uses that canonical name; the existing local checkout directory has not been moved. All documentation and planned implementation paths are relative to this root.

## Stack (verified in P1.1 & P1.2)

pnpm 12 + Turborepo 2; Vite 6 + React 19 + TypeScript 5.9 + `@module-federation/vite` microfrontends (`shell`, `auth-mfe`, `profile-mfe`, `resume-mfe`); Tailwind v4 + shadcn/ui + `performative-ui@0.7.0` wrappers in `@resume-forge/shared`; Hono 4 services on Node.js 22; local PostgreSQL 18 + Prisma 7 + pgvector 0.8.7 (real embedding model/dimensions and hosting deferred). Google OAuth is implemented; LinkedIn is on hold. Trigger.dev, Vercel AI SDK/Gemini, Cloudflare Pages and R2 remain planned integrations. See [architecture](context/architecture-context.md) and [progress tracker](context/progress-tracker.md) for pinned versions and actual implementation status.

## Development

Requires Node.js 22+ and the pinned pnpm 12.6.0. From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:3000**. The shell checks your session first: signed-out users see sign-in, incomplete accounts see the profile-setup entry, and completed accounts enter their personal workspace. All three frontend modules, the gateway, auth and profile services start together. Initialize local PostgreSQL/runtime roles and auth transport below first. Starting only the shell will leave module-backed pages unavailable. Stop with Ctrl+C.

Workspace screens require a verified local session and use its personal workspace ID. They still contain sample content: create-mode selection, section selection/review/apply, profile validation, themes and responsive navigation are interactive. Changes are local to the mounted preview and reset when leaving it or losing access. These screens are not connected to profile/resume persistence, AI, scoring or PDF export. Profile setup is an honest pending entry, not a completed wizard. Follow [Google login setup](docs/google-login.md) for server credentials and manual routing checks. Standalone remotes remain synthetic previews.

```bash
pnpm build   # Build all workspace packages
pnpm check   # Lint and typecheck, including dependency builds
```

To inspect built output instead of development servers, stop `pnpm dev`, run `pnpm build`, then:

```bash
pnpm --parallel --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe preview
```

This serves the frontend production builds on ports 3000–3003. The gateway is not required for the sample UI. Shared styles are a built package; after editing them during development, run `pnpm --filter @resume-forge/shared build` and refresh, or restart `pnpm dev`.

See [UI review and verification](docs/ui-redesign-review.md) for the latest changes and manual checks. The 2026-09-29 planning notes below describe earlier stages; the current tracker takes precedence.

### Local PostgreSQL

Install PostgreSQL command-line tools (`initdb`, `pg_ctl`, `psql`, `createdb`, `pg_dump`) on your PATH. Verified with Homebrew PostgreSQL 18.3, Prisma 7.10.0 and pgvector 0.8.7. On this Mac pgvector is installed; on another Homebrew development Mac run `brew install pgvector` for a compatible PostgreSQL version. From the repository root:

```bash
pnpm db:local:start
pnpm db:migrate
pnpm db:vector:init
pnpm db:runtime:init
pnpm auth:local:init
pnpm db:test
pnpm db:test:audit
pnpm db:test:roles
pnpm db:test:profile
pnpm db:test:vector
pnpm audit:local:init
# In another terminal, keep the recipient running: pnpm audit:serve:local
pnpm audit:deliver:local
# For automatic delivery in a dedicated terminal: pnpm audit:worker:local
pnpm db:local:status
# When finished:
pnpm db:local:stop
```

The dedicated cluster listens only on `127.0.0.1:55432`, uses SCRAM password authentication, and stores data/credentials in ignored `.local/` (do not delete it to reset development). Prisma CLI reads `.local/database.env` automatically; an explicit `DATABASE_URL` overrides it for migrations. Database tests always use the managed local cluster, create disposable test databases, and remove only those databases. Expect 14 passes from `db:test` (including atomic capture, rollback and backup/restore), 12 from `db:test:audit` (delivery, retry, scope and crash recovery), and 44 from `db:test:profile` (22 professional create/read/update/draft cases plus 22 Work Experience list/add/update cases, including shared revision races, consistent reads, entry limits, blocked-write expiry and audit rollback). `db:local:start` is safe to repeat and preserves data.

`db:vector:init` prints `Local pgvector 0.8.7 ready in resume_forge_dev` and is safe to repeat. `db:test:vector` should show six passes in the terminal; all vectors are synthetic and its test database is removed afterward. Vector storage runs inside local PostgreSQL; no separate vector service or hosted account is needed. Actual embeddings, model/dimension choices and application indexes remain pending D07 and your AI details. Both vector commands ignore root/hosted database settings. Installation follows the [official pgvector documentation](https://github.com/pgvector/pgvector#installation).

The local audit command processes one bounded batch and prints summary/backlog counts; an empty development queue reports all zeros. Tests do not seed this queue. It ignores hosted/root database settings and delivers over authenticated loopback HTTP to workspace-service on port 4005. Run `audit:local:init` once and keep `audit:serve:local` running in another terminal. The generated credential stays in ignored `.local/`; automatic local delivery is available through `audit:worker:local` (five events per pass, five seconds between completed passes; Ctrl-C to stop). Hosted supervision remains pending. Storage models, Google/session lifecycle, atomic capture and local audit delivery foundations are implemented; sample UI persistence and shared workspaces remain pending. Administrative credentials remain for migrations/disposable tests; auth, profile capture, relay and ingestion now have separate restricted runtime roles. Run `db:runtime:init` and restart local services; private domain APIs still require application authorization. See [runtime database roles](docs/runtime-database-roles.md). See [database foundation](docs/database-foundation.md) for retry behavior and remaining limits.

## Latest planning update

The [manual editor](docs/manual-editor-verification.md) now supports direct paper editing across the header, Summary, Experience, Education, Projects, grouped Skills and Languages, contextual actions and validated dialogs. Open My resumes → Backend engineer in the local app. Saves remain in memory and reset on reload or leaving the editor; real draft creation, contacts, durable resume storage, ATS, PDF and AI remain pending.

The local [professional profile API](docs/profile-api.md) explicitly creates a missing owned master, reads/updates existing professional fields and partially saves incomplete professional drafts on port 4002, with duplicate/revision/completion conflicts and transactional audit capture. The [Work Experience API](docs/experience-api.md) now lists/adds/updates owned entries with stable IDs, strict dates/plain bullets and the same master revision. Both APIs use user-supplied professional facts and copy no auth/contact facts. Follow [actor resolution](docs/actor-resolution.md) for the session boundary. Application database connections use UTC; restart local services to load changes. Entry deletion/reorder, other section/contact APIs, onboarding completion, gateway and browser integration remain pending; canvas Save still only changes memory.

2026-09-29: added Performative UI integration and contextual resume-section prompting to the plan. The proposed flow supports a basic profile-derived resume or JD tailoring, followed by reviewable section changes and explicit version saves. CareerZenith informs resume capabilities only. Visual concepts are paused; no package has been installed or application developed. Remaining decisions, including file intake, are in [decisions](context/decisions.md).

Follow-up: the planned Performative UI use now includes backgrounds, surfaces and accents alongside shadcn/ui. The signed-in reference editor has been inspected through authorized Chrome access; findings and limits are recorded in the frontend integration document.

Latest follow-up: [resume capability coverage](context/resume-capability-coverage.md) maps all identified resume features to owners and phases. Dashboard search/sort/clone/active selection and builder/issue workflows are explicit. Proposed [Phase 6](context/build-plans/06-builder-expansion.md) adds file import and full template/format controls as F19/F20. This supersedes the earlier unallocated intake/template backlog; technical decisions and development approval remain open.

## GitHub preparation

Commit `.gitignore`, `README.md`, `AGENTS.md`, `project-tracker.md`, and all Markdown files under `context/` and `docs/`. The root `.gitignore` excludes local secrets, dependencies, generated output, logs, temporary uploads/exports and local CodeGraph metadata. Sanitized `.env.example` / `.env.*.example` templates and the future pnpm lockfile remain eligible to commit. No blanket Markdown rule is used.

Repository creation and pushing to GitHub are a later step. This naming and repository-hygiene update does not authorize application development.
