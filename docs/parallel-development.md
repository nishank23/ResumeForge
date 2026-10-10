# Frontend and backend development lanes

## Release branch transition — 2026-10-10

The user authorized committing all pending ux-ui-update work, creating and merging its PR into main, retiring local/remote features and ux-ui-update after integration, then creating and checking out **fixes** from merged main. Subsequent work uses **fixes** in the existing frontend worktree. This supersedes earlier active-branch names below. Preserve the detached primary runtime checkout and backend worktree. Branch retirement occurs only after confirming all their commits are included in main.

## Current UI branch workflow — 2026-10-10

The user requested PR integration of the completed fixes, then a new branch named **ux-ui-update**. PR [#4](https://github.com/resuming-v2/ResumeForge/pull/4) is merged into main at `c713cf43426dd67b10b96ef563baa6d21d7ba03d`. The new branch was created from that commit, pushed to origin and checked out in `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2`. Future work and scheduled checks use **ux-ui-update**, superseding the active features requirement below.

The original detached checkout, authoritative private runtime files and separate backend checkout remain intact. Existing ownership, task locks, contract and integration rules apply. [Original Performative UI design direction](ux-ui-update-plan.md) is planning for the new branch, not completed visual work.

## Current branch workflow — 2026-10-08

The user requests one integration PR into `main`, deletion of the old remote frontend/backend branches after the merge, and a new `features` branch created from the merged main commit. Subsequent work uses `features` in `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2`; the directory name does not prescribe a branch prefix. Push `features` with an upstream to `origin/features`. Do not recreate the retired remote branches.

Backend commits through `9e6157b` already belong to main via PR #2. The remaining backend checkout change is generated lockfile resolution: the release reconciles it with the newer frontend import dependencies, retaining Mammoth/PDF.js and the backend's typescript-eslint 8.71.0 resolutions. The backend checkout and its local edits stay intact; no switch/reset/removal is needed. Private configuration, PostgreSQL, ignored dependencies and user-supplied `check_resumes` inputs are excluded from the release.

Existing ownership, policy and review boundaries remain. Scheduled frontend work verifies `features` and uses this worktree's task lock. Keep main for reviewed integration. New backend work needs a separately assigned branch and allowed paths; the old Gemini starting prompt below is historical and must not recreate a retired remote branch.

## Historical two-lane setup — 2026-10-04


**Current integration — 2026-10-04:** The latest user request removes required Create profile onboarding and replaces the sample resume with an owned library/upload/review/version-save flow. Work runs in the named frontend worktree; port 4003 now belongs to the restricted personal resume service. Dialog Save changes the working draft; editor Save changes persists a version. Professional profile editing remains optional. Earlier sample/reset/profile-first or stopped-resume statements below are historical. [Current changes, startup and manual checks](../README.md#resume-library-upload-and-database-saves--2026-10-04).

The user selected a committed baseline, two branches and separate checkouts on 2026-10-04. Branches alone do not isolate simultaneous edits when agents share one working folder.

## Checkouts

- `main`: reviewed sidebar baseline `5f7b9fb`; keep it for integrated work.
- `codex/frontend`: `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2`. This managed worktree is named `frontend` and attached to this chat. Codex performs all new frontend/integration work here.
- Original checkout: `/Users/nishankbansal/Downloads/ResumeBuilderv2`, detached at pushed commit `0dc79ec`. Preserve its existing services and development data; do not implement new work in this folder.
- `codex/backend`: `/Users/nishankbansal/Downloads/backend`, as verified by `git worktree list` during the frontend move. The external backend lane remains separate; do not switch, reset or remove it.

Both branches started from the same baseline. A small shared workflow commit follows it. No Gemini process was launched, dependencies installed in its checkout, secrets copied or code pushed during setup.

## Frontend worktree move — 2026-10-04

Created the named `frontend` worktree from pushed frontend commit `0dc79ec`, then moved the `codex/frontend` branch checkout from the clean original folder into it. The original is detached at the same commit, so its checked-out application files did not change. The backend worktree was not altered. Future commands and scheduled work must explicitly use the new frontend path, read its README/tracker and claim its own local task lock. No new feature, dependency, migration, service restart or deployment is part of this move. Ignored dependencies, credentials, task locks and database directories were not copied; install locked dependencies in this checkout before its package checks.

## File ownership

- Codex frontend: `apps/shell`, `apps/profile-mfe`, `apps/resume-mfe`, shared UI components and styles in `packages/shared`. Preserve authentication and completed canvas editing; choose only tracker-approved slices.
- Backend agent's first task: owned Education list/add in `services/profile-service`, its tests and `docs/handoffs/backend-education.md`. Read the F04 specification and existing Experience contract before choosing fields or behavior. This assignment does not authorize deletion/reorder, other sections, contacts, durable resumes or completion.
- Codex coordinator only: public API/domain contracts, the canonical tracker, root README outside the local task marker, AGENTS, dependencies/lockfile, Prisma schema/migrations, access-policy/resume-core and other shared packages. The backend agent reports required changes here as proposals before implementing dependent behavior. Existing service-local validation can be changed within the agreed task.

Do not edit outside the assigned paths, reformat the whole repository, switch the other checkout's branch, reset another agent's work, commit credentials or overwrite approved gates. File ownership reduces conflicts but cannot guarantee zero integration fixes.

## Coordination and verification

1. Each agent checks its own README marker and `pnpm task:status`, then claims one bounded task using the existing helper. Locks do not expire and are local to each checkout. Finish with the returned owner token. Never copy `.local` locks or database directories between checkouts.
2. Codex owns the canonical progress tracker. The backend agent records files changed, API proposal, exact checks/results, limitations, manual checks and required shared changes in its handoff document. Task marker changes are runtime bookkeeping and should not be included in the backend feature patch.
3. Existing frontend heartbeat follows branch ownership in [scheduled development](scheduled-development.md). It cannot take backend work when frontend work is blocked. Gemini is run manually in its own checkout; this setup does not provide automatic Gemini orchestration.
4. Keep one frontend stack on ports 3000–3003, now running from the named frontend worktree, and preserve the original checkout's managed local PostgreSQL and backend configuration. The gateway is restored; auth/profile startup is currently blocked by a local runtime-password mismatch documented in the tracker. Do not start a second stack on the same ports, initialize another dev cluster, migrate shared development data or change hosted settings. Backend tests must use disposable local databases and synthetic fixtures. Missing dependencies/local test configuration must be resolved without copying credentials into chat or Git.
5. Backend handoff contains a feature-only diff or branch commit plus its tested base revision. Do not merge, push, deploy or modify `main` from the backend lane. Codex reviews the diff, resolves conflicts, incorporates tracker/contracts, runs relevant combined checks and verifies connected browser behavior before integration into `main`. The user should not need to resolve file merges.

## Gemini starting prompt

Open the backend checkout above, then paste:

```text
Work only on codex/backend in this checkout. Read AGENTS.md,
docs/parallel-development.md, context/progress-tracker.md,
context/feature-specs/04-profile-wizard.md and docs/experience-api.md.
Honor the current task marker and pnpm task:status; claim one bounded slice.

Implement only owned Education list/add and its relevant tests, reusing
existing actor, ownership, master revision and transactional audit patterns.
Inspect actual schema/contracts first. Preserve contacts, other profile
fields, completed editor work and all approval gates. Use local PostgreSQL
with disposable synthetic test databases; no hosted services or secrets.

Edit only services/profile-service, its tests and
docs/handoffs/backend-education.md. Propose required shared schema,
dependency or public-contract changes in the handoff before proceeding.
Do not edit frontend, shared packages, canonical tracker or other docs.
Do not merge, push, deploy or modify main. Return a feature-only diff,
exact test results, manual checks and blockers. Finish your own task token;
exclude README task bookkeeping from the feature patch. Codex handles
review, integration and canonical tracker updates.
```

## Setup checks

Run `git branch --show-current`, `git status --short` and `git worktree list` in the original checkout. They verified `codex/frontend` here and `codex/backend` in the backend folder, with clean checkouts after sharing the workflow commit. The frontend's `pnpm task:status` and backend's dependency-free `node scripts/development-task.mjs status` both reported idle.

In the fresh backend worktree, `pnpm task:status` attempted dependency setup and failed to create a virtual-store slot under the current sandbox (`ERR_PNPM_PACKAGE_MANAGER_CREATE_SLOT_DIR`). No tracked files changed. Install the locked dependencies with `pnpm install --frozen-lockfile` in the backend agent's authorized environment before package checks. The direct Node task helper does not require dependencies and verified state without installing them. Real backend behavior and combined integration are not yet tested by branch setup.

## Personal runtime repair and worktree startup — 2026-10-04

The latest user request authorizes sign-in repair. Existing primary-checkout runtime passwords/grants were reapplied; auth/profile now pass startup and the browser session restores. All active personal service code now runs from the named frontend worktree with `pnpm dev:personal`. Only the original checkout's ignored `.env`/`.local` files and existing PostgreSQL cluster remain authoritative. The launcher resolves that primary checkout or an explicit `RESUME_FORGE_LOCAL_ROOT`, without copying credentials. Do not run an independent role initializer against a competing worktree credential file: it overwrites cluster-global passwords. Future shared-role repair requires coordination and service restart; normal startup never repairs roles automatically. Resume/workspace business startup remains gated by the readiness report. The external backend checkout was not changed. [README](../README.md#personal-profile-integration-and-sign-in-repair--2026-10-04) has current commands and manual checks; older startup/password-block notes above are historical.
