# resume-forge

## Current development task

<!-- BEGIN:CURRENT_TASK -->
```json
{
  "status": "idle",
  "task": null,
  "owner": null,
  "startedAt": null,
  "updatedAt": "2026-10-08T17:30:52.871Z",
  "lastResult": "Release validated: check 31/31, test 201 cases, build 14/14, DB 11/11. features workflow ready; integration uses one reviewed PR."
}
```
<!-- END:CURRENT_TASK -->

The Codex heartbeat checks this task every **15 minutes**. An `ongoing` task is skipped, including a task that takes longer than 15 minutes. When idle, read the [canonical tracker](context/progress-tracker.md), claim one unblocked slice with `pnpm task:start "Short task title"`, retain the returned owner token, and finish with `pnpm task:finish OWNER "Actual result and remaining limitation"`. `pnpm task:status` also checks an atomic ignored `.local/development-task.lock`; a competing start exits 2 without changing the README. Invalid or inconsistent state stops new work. Do not remove a stale lock or overwrite an ongoing marker until the previous run is confirmed stopped. See [scheduled development](docs/scheduled-development.md) for recovery and verification. Keep Codex open and this Mac awake for local checks.

**Earlier frontend slice — 2026-10-03:** The sample established canvas editing, dialogs and history. The current resume-first integration below replaces its browser-only persistence boundary with owned database versions.

**Earlier frontend fix — 2026-10-04 (superseded by the A4 correction below):** Contextual actions are centered below the active section without shifting the resume or covering the next heading; mobile retains its action dock. [Before/after and manual checks](docs/manual-editor-verification.md#toolbar-positioning-correction--2026-10-04).

**AI dialog preview — 2026-10-04:** Improve with AI opens a selected-target dialog with temporary Thinking, Suggested changes and No changes needed states. Accept/Cancel and Undo work locally; every state identifies the disconnected AI service. [Actual checks and manual steps](docs/ai-preview-verification.md). This is frontend-only and resets on reload.

A planned multi-tenant resume and professional-profile platform for individuals, organizations, and vendors. It tailors resumes to supplied job descriptions without changing the master profile.

**Skills update — 2026-10-04:** Languages are grouped inside Skills; click Skills for category/tag editing without an AI toolbar. Extra paragraph spacing is removed. [Verification and manual checks](docs/manual-editor-verification.md#skills-dialog-and-compact-spacing--2026-10-04) record desktop/keyboard results and mobile verification pending. Saves still reset on reload.

**Current stage: Phase 1 in progress — P1.1 toolchain/scaffold and P1.2 shared UI/shell (F01) complete.** P1.3 foundations and resume-first personal integration are in progress. The tracker records the current gate and supersedes earlier planning-stage status notes.

**Editor tools — 2026-10-04:** Added Back to all resumes and Edit Content, Customize Template, ATS Score and Optimize for JD panels. Typography/spacing previews share local checkpoints/history; ATS/JD services and PDF remain pending. [Results and manual checks](docs/editor-panels-verification.md).

**Workspace sidebar — 2026-10-04:** Collapse sidebar below the logo folds the first column into a 72px icon rail. Expand restores its labels; mobile keeps the existing navigation menu. The choice resets on reload. [Screenshots and manual checks](docs/workspace-sidebar-verification.md).

## Integration and branch workflow — 2026-10-08

The completed account/profile integration, resume library/upload/review/database saves, import-field correction and A4 layout are being released through one PR into main. Backend source was already merged through PR #2. The combined lockfile also preserves the backend's pending typescript-eslint 8.71.0 resolution changes alongside the new import dependencies. Private runtime files, local database data and user-supplied resume samples are excluded from Git.

After the merge, remove `origin/codex/frontend` and `origin/codex/backend`, create **features** from the merged main commit, and push its upstream as `origin/features`. Continue using `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2`. The separate backend checkout/local edits remain intact. Updated AGENTS and scheduled-work instructions use `features`; earlier branch references below are historical. [Current workflow](docs/parallel-development.md#current-branch-workflow--2026-10-08).

Release validation: frozen offline install passed; `pnpm check` **31/31**, `pnpm test` **25/25 tasks / 201 cases**, `pnpm build` **14/14** and the disposable resume-editor database suite **11/11** passed. Existing browser/manual evidence is recorded below. This checkpoint adds no deployment, provider integration or database migration.

## A4 resume page and scroll controls — 2026-10-08

The builder now uses a fixed **794 × 1123 CSS-pixel A4 sheet**. The supplied one-page import measures one A4 page in both Editor and Preview; all 69 checked populated text fields remain. Previously the narrow canvas, responsive row stacking, empty optional placeholders and 52px editing gutters stretched this sample to 1977px.

- **Fit page** is the initial overview; **Fit width** and **100%** provide larger editing views. Zoom scales the view without changing facts, saved formatting, history or database versions. The paper keeps its A4 width, date alignment and skill columns when the sidebar, tool panel or screen size changes.
- New/imported documents without saved appearance use compact bounded defaults: 28px margins, 12px section gaps, 6px entry gaps and 13px body type at 1.2 line height. Explicit saved appearance is retained. Customize Template can change these settings; use Save changes to persist formatting or Cancel to restore the saved draft.
- Selected-content actions now sit in the desktop editor header, with the selected target label. Mobile retains its bottom action dock. Removing action gutters keeps Editor and Preview document spacing consistent. Empty optional descriptions, locations and technology rows consume no paper space; their fields remain available in Edit dialogs.
- The whole desktop tool rail sticks and scrolls together. Collapse no longer moves underneath Customize Template, ATS Score or Optimize for JD. Tool panels measure the editor header height so their headings and controls remain below it while scrolling.
- Content exceeding A4 height remains fully visible, with an overflow notice and an estimated page count. Fit page is a zoom control, not automatic content shortening or a PDF renderer. Long drafts still use a continuous extended sheet; true multi-page export and matching PDF rendering remain pending.

### Manual layout check

1. Reload the [local app](http://localhost:3000/), open My resumes and reopen the corrected import. Expect **A4 · 1 page**. Fit page shows the overview; choose Fit width or 100% to read and edit at a larger size. Check the final Skills/Languages row and all previous section content.
2. In Fit width, scroll to the bottom. Customize Template, ATS Score, Optimize for JD and Collapse must remain separate clickable controls. Collapse/reopen the tool panel and verify dates and skill columns retain the same paper layout. On short windows the rail has its own scroll area.
3. Select content, open Edit and Cancel. Focus returns to Edit selected content. Switch Editor/Preview: the paper has the same page length, and Preview hides editing actions. View-only changes leave Save changes disabled.
4. For a reversible overflow check, open Customize Template → Pre-built layouts → Spacious. This sample exceeds one page and displays the notice while keeping every field. Click the editor Cancel button to restore the saved appearance; no version is written unless Save changes is explicitly clicked.
5. At phone/tablet widths, check the horizontal tool row or desktop rail, collapse the settings panel, and use Fit width for readable text. A4 geometry stays fixed; only zoom changes. At 100% a narrow canvas scrolls horizontally inside the paper viewer.

### Layout verification

- `pnpm --filter @resume-forge/resume-mfe lint` and `pnpm --filter @resume-forge/resume-mfe build` passed (the build includes TypeScript). `pnpm --filter @resume-forge/resume-mfe test` passed **33/33**.
- Live Chrome at 1280×538, 900×800 and 390×844 retained the same 794×1123 sheet and all **69 checked fields**. Fit width produced no page/body horizontal overflow; 100% displayed the actual 794px width. Default Fit page cleared the desktop viewport edge. Desktop bottom-scroll geometry confirmed no rail overlap and a settings panel below the sticky header; all three tool buttons remained usable.
- Edit/Cancel focus return, Preview, collapse/reopen, formatting overflow and Cancel restoration passed. Spacious measured 1610px with the notice and all 69 fields retained; Cancel returned to 1123px. Browser warning/error log was empty. Formatting bounds/history tests passed; no database, API, credential or provider changes were required for this layout fix. These checks do not verify PDF export.

## Uploaded resume field correction — 2026-10-08

Fixed incomplete mapping between extracted text and the resume builder. A fresh upload of the user-supplied one-page PDF previously produced only three sections, with work/education absorbed into Summary and two projects split into eight entries. The corrected upload has five sections, three jobs, one education entry and two projects.

- PDF extraction now reconstructs visual rows/columns instead of PDF drawing order. Adjacent small-cap glyphs stay together, right-aligned dates/location metadata remain separate, and HTTP/HTTPS hyperlink annotation destinations survive username-only labels. URLs are treated as data and never fetched. Existing worker size/time/memory limits remain enforced.
- The deterministic parser recognizes plural Experience/Education headings, keeps wrapped unmarked achievement text with its entry, and preserves role/company, employment/location type, dates, degree/field, project role, technologies and project links. Contact location and profile links come from the header rather than summary/job prose.
- The editor preserves header profile links, renders them on the paper, and exposes label/URL controls under **Personal information → Profile links**. The optional bounded `header.links` field is validated and versioned; older saved editor documents without it remain readable. Unsafe URL schemes and duplicate IDs are rejected.
- Imported Languages group values and standalone language bullets now reach the actual language fields under Skills. Other skill categories and their item identities survive the adapter and save/reload.
- Earlier saved imports retain their existing content. This fix applies to a fresh upload; it does not silently reparse or replace edits in an existing saved resume. A corrected new import was saved and left open locally for review. No private resume text, contact values or screenshots were added as repository fixtures.

### Manual check

1. Use the running [local app](http://localhost:3000/), or start the frontend worktree with the `dev:personal` command below. Sign in and open **My resumes → Upload resume**. Select the PDF in the original checkout's `check_resumes` folder.
2. Compare **Review the extracted text** with the paper: Summary must contain only the summary; Work Experiences must have three jobs; Education one school; Projects two projects. Check the 8 job achievements and 7 project achievements, wrapped text, company/role/type/location, all six date ranges, degree/field, technologies and project link.
3. Open **Personal information**. Check name/headline/contact location and both profile links. Cancel preserves the import. Under **Skills**, expect five technical/soft-skill categories with 17 items plus four spoken languages (21 items total).
4. Click **Confirm and save resume**. Expect **Saved version 1** and **Saved to your account**. Reload, return to the library and reopen the newest import. Check the same fields and links in **Preview**. Opening an older import still shows its prior mapping; re-upload creates the corrected version as a separate resume.

### Verification

- Shared-types build/lint/typecheck passed. Resume-service build/lint/typecheck passed; **59/59** service tests passed, including synthetic PDF geometry/link and parser regressions. Resume-MFE production build/lint passed; **33/33** editor tests passed, including import adapter and strict link/ID validation.
- `RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 pnpm --filter @resume-forge/resume-service test:editor:db` passed **11/11**, including its parent case. The disposable database suite covers header/project links, project dates, languages, independent reads, ownership, version conflicts and restricted access.
- Live browser: reproduced the failure, uploaded the same source after the fix, confirmed a new local resume, performed a full reload and reopened it from the library. All **69 checked populated text fields**, **six date ranges** and **three links** remained. Profile-link dialog values matched; Cancel kept the saved document. No browser warning/error logs were captured.

The parser remains heuristic and requires review; arbitrary multi-column layouts, scans/OCR and encrypted PDFs are not covered by this sample. Original formatting is not reproduced. AI, ATS, PDF export and master-profile merge retain their existing pending status.

## Resume library, upload and database saves — 2026-10-04

All new code runs from `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2` on `codex/frontend`. This update supersedes the earlier profile-first onboarding and browser-only sample editor. The backend checkout is unchanged.

### What changed

- Google sign-in now opens **My resumes** directly. There is no required **Create profile** step. The old onboarding URL redirects to the library. The optional profile page displays the signed-in identity when professional details are absent; existing professional fields remain editable through the already connected revision-checked profile API. LinkedIn remains unavailable until its credentials are configured.
- Replaced the sample resume with an upload/create banner and the authenticated user's saved resumes. The table shows actual saved versions and update dates. Search and sorting apply to loaded rows; **Load more resumes** fetches another 50. Empty, loading, failed-load, retry and no-search-result states are explicit. No invented readiness rating is displayed.
- **Create resume** creates a private owned draft in PostgreSQL with version 1. Only the signed-in display name is prefilled. Contacts and professional content start empty; sample autofill is disabled for owned resumes. Stable creation IDs make uncertain creation retries return the original resume without extra versions or audit events.
- **Save changes** persists the entire validated editor document with an expected version. Rich text, dates, IDs, section order, visibility, Skills/Languages and appearance survive reload. Each successful save creates an immutable version and a content-free audit intent in the same transaction. Failed saves retain mounted edits. A stale version returns 409 and blocks another save until reload; simultaneous saves cannot overwrite each other.
- Inline edits are committed before saving. Dialog **Save** changes the working draft; the editor's **Save changes** persists it. Undo/Redo remain local. Cancel restores the last acknowledged document. Changes typed during a pending save stay unsaved. Back to the library warns about unsaved changes; browser unload also warns. Other in-app navigation can still discard unsaved edits, so save before changing pages.
- **Upload resume** extracts a supported file into an editable review draft. Inspect the extracted source text, correct fields and click **Confirm and save resume** to create version 1. Cancel before confirmation creates no resume. Parsing is authenticated, rechecks access after processing and never creates or updates a master professional profile or UserContact.
- The schema requires a profile foreign key. If missing, creation inserts an empty internal anchor only. It does not copy imported professional facts, contacts or OAuth credentials into the master profile. Deriving a master profile from reviewed resume facts remains a separate future confirmation flow.
- Gateway and the active resume service expose only personal create, parse, list, load and manual save. The service uses the explicitly approved `rf_local_resume` role and checks its grants at startup. It cannot read OAuth credentials or UserContact. Existing auth/profile passwords are preserved. No schema migration was needed. See [approved role and applied grants](docs/resume-runtime-approval.md).

### Upload limits and retention

Supported formats: text-based PDF, DOCX, TXT and Markdown. Files must be at most 10 MB; PDFs have a 30-page limit. DOCX archives are limited to 2,000 entries and 20 MB declared uncompressed content. Parsed text is capped at 500,000 characters; saved document requests are capped at 2,000,000 bytes. Scanned PDFs, encrypted/corrupt files, legacy DOC, invalid UTF-8 and unsafe archives fail with a recoverable error.

Extraction runs locally in a worker with an 8-second timeout, two concurrent workers and bounded memory. PDF.js 5.4.624 and Mammoth 1.13.0 are pinned. No external AI provider receives uploads. Original file bytes are discarded after processing; confirmed extracted text and structured content are private resume/version data in the local database. Import does not preserve the original file layout. The heuristic parser can misclassify sections; review and correct them before confirmation. OCR, private object-storage staging, field-level provenance and master-profile merge are not implemented.

### Start the complete personal app

From the frontend worktree:

```bash
RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 pnpm dev:personal
```

Use [localhost:3000](http://localhost:3000/). This command builds shared service dependencies, then starts shell/auth/profile/resume frontends on 3000–3003 and gateway/auth/profile/resume services on 4000–4003. It uses the primary checkout's ignored local database, managed runtime and auth transport configuration. PostgreSQL must already be running on 127.0.0.1:55432. The unrelated workspace business service must not occupy 4003. Startup refuses missing/mismatched credentials rather than falling back to the administrator account.

The terminal reports the service listeners. The gateway health endpoint is [localhost:4000/api/v1/health](http://localhost:4000/api/v1/health). Opening 3003 alone does not provide an authenticated workspace; use the shell at 3000.

The earlier sign-in outage was a PostgreSQL `28P01` password mismatch for auth/profile runtime roles. Those roles were reconciled with their existing ignored managed configuration. Existing browser sessions restore successfully. Fresh Google consent remains a user-run check; LinkedIn requires credentials and is not claimed working.

### Manual checks

1. Open 3000 and sign in with Google if needed. Expect **My resumes**, with no Create profile requirement. Open Profile optionally; it should show your account identity or saved professional details.
2. Click **Create resume**. Expect an editable owned resume at a UUID URL and saved version 1. Rename it, add your own Summary/Experience/Skills, edit formatting or visibility, then click **Save changes**. Expect a higher saved version and no unsaved marker.
3. Reload the page. Your title, fields, Skills/Languages, visibility and formatting should remain. Click **Back to all resumes** and reopen the same row. Search by title and clear search. If you have over 50 resumes, use **Load more resumes** before searching those later rows.
4. Click **Upload resume**, choose a small text PDF/DOCX/TXT/MD, and review the extracted fields and source text. Correct mistakes. Click **Confirm and save resume**, reload and reopen it from the library. Cancel a separate upload before confirmation; it must not create a resume. Try a scanned PDF or unsupported DOC; expect a readable error and the option to choose another file.
5. Open the same saved resume in two tabs. Edit both. Save tab A, then tab B. Tab B should keep its edits and report that the saved version changed. Copy anything you need before reloading B; reload loads A's saved version. No automatic overwrite occurs.
6. Change a field and use the editor's Back control. Expect the leave/stay confirmation. Stay keeps edits; leave discards only unsaved edits. Dialog Cancel restores its opening draft; editor Cancel restores the last saved document. Save before sidebar navigation.
7. Check at a narrow mobile width: banner buttons stack, search/sort remain usable and resume names/Open controls fit without horizontal page overflow. Real device touch, IME and screen-reader speech remain unverified.

### Verification and remaining work

Focused frontend, session, gateway, extraction and service unit tests pass. Disposable PostgreSQL tests exercise the actual frontend client through the gateway/service using a restricted role: blank creation without setup, save/reload, immutable versions, retry deduplication, conflicts, ownership/selector isolation, forbidden credential/contact/profile writes, parse without persistence and bounded pagination. Synthetic fixtures contain no real account or resume facts. Browser checks cover account-session restoration, creation, title save to version 2, full reload, list reopening, PDF review/cancel, search, desktop dark/light and 390px layout. A blank owned resume used for the browser check remains in the account library.

Repeat the selected checks from this worktree:

```bash
pnpm --filter @resume-forge/shared --filter @resume-forge/shell --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe --filter @resume-forge/gateway --filter @resume-forge/resume-service -r test
pnpm --filter @resume-forge/shared... --filter @resume-forge/auth-service... --filter @resume-forge/profile-service... --filter @resume-forge/resume-service... --filter @resume-forge/gateway... -r build
RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 node --experimental-strip-types --test services/auth-service/test/auth.test.mjs services/profile-service/test/profile.test.mjs services/resume-service/test/editor.db.test.mjs
```

Test totals and final commands are recorded in the [progress tracker](context/progress-tracker.md#resume-first-library-upload-and-persistence--2026-10-04). Database suites create and drop disposable synthetic databases; they do not replace development accounts. Full F10 management, shared-workspace privacy variants, contact APIs, reviewed master-profile derivation, real grounded AI, ATS/JD scoring and PDF export remain pending. The temporary AI dialogs still operate locally; Accept changes the working draft and requires **Save changes** for persistence. AI/ATS/PDF controls do not imply those server capabilities are enabled.

## Start here

**Frontend worktree — 2026-10-04:** All new frontend work uses `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2` on `codex/frontend`. The original checkout is retained at detached commit `0dc79ec` for its authoritative private configuration and database; active personal service code now runs from this frontend worktree. Use the new worktree's own task marker/lock. [Current checkout paths and coordination](docs/parallel-development.md).

For frontend-only development in this worktree, install the frozen lockfile, build `@resume-forge/shared-types` and `@resume-forge/shared`, then run:

```bash
pnpm --parallel --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe dev
```

The standalone resume remote at `http://localhost:3003/` links to the authenticated shell at `http://localhost:3000/`. These four frontend servers run from this worktree. For authenticated profile/resume work, use **`pnpm dev:personal`** above. The local auth/profile password mismatch is repaired; private configuration and the existing database remain in the original checkout. Do not initialize a second cluster or copy secrets into this worktree.

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
pnpm dev:personal
```

Open **http://localhost:3000**. Signed-out users see sign-in; every verified personal account enters My resumes regardless of profile-completion status. `dev:personal` starts shell, three frontend modules, gateway and auth/profile/resume services. Local PostgreSQL/runtime roles and auth transport must already be configured. Starting only the shell leaves module-backed pages unavailable. Stop with Ctrl+C.

Workspace screens require a verified local session and its personal workspace ID. The library and manual editor use owned database records; professional profile fields also persist. Upload/create and Save changes are described above. Real AI, scoring, PDF, complete professional section/contact UI and shared-workspace activation remain pending. Follow [Google login setup](docs/google-login.md) for credentials and routing checks. Standalone remotes link to the signed-in shell.

```bash
pnpm build   # Build all workspace packages
pnpm check   # Lint and typecheck, including dependency builds
```

To inspect built output instead of development servers, stop `pnpm dev:personal`, run `pnpm build`, then:

```bash
pnpm --parallel --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe preview
```

This serves the frontend production builds on ports 3000–3003. Profile/resume persistence requires the gateway/auth/profile/resume services. Preview commands alone serve only frontend assets. Shared styles are a built package; after editing them during development, run `pnpm --filter @resume-forge/shared build` and refresh, or restart `pnpm dev`.

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

The local [professional profile API](docs/profile-api.md) explicitly creates a missing owned master, reads/updates existing professional fields and partially saves incomplete professional drafts on port 4002, with duplicate/revision/completion conflicts and transactional audit capture. The [Work Experience API](docs/experience-api.md) now lists/adds/updates owned entries with stable IDs, strict dates/plain bullets and the same master revision. Both APIs use user-supplied professional facts and copy no auth/contact facts. Follow [actor resolution](docs/actor-resolution.md) for the session boundary. Application database connections use UTC; restart local services to load changes. Main now includes additional backend section/contact/completion APIs, whose broader acceptance is separate. Professional profile gateway/browser integration is connected in the slice above; full onboarding and section/contact UI remain pending. Canvas Save still only changes memory.

2026-09-29: added Performative UI integration and contextual resume-section prompting to the plan. The proposed flow supports a basic profile-derived resume or JD tailoring, followed by reviewable section changes and explicit version saves. CareerZenith informs resume capabilities only. Visual concepts are paused; no package has been installed or application developed. Remaining decisions, including file intake, are in [decisions](context/decisions.md).

Follow-up: the planned Performative UI use now includes backgrounds, surfaces and accents alongside shadcn/ui. The signed-in reference editor has been inspected through authorized Chrome access; findings and limits are recorded in the frontend integration document.

Latest follow-up: [resume capability coverage](context/resume-capability-coverage.md) maps all identified resume features to owners and phases. Dashboard search/sort/clone/active selection and builder/issue workflows are explicit. Proposed [Phase 6](context/build-plans/06-builder-expansion.md) adds file import and full template/format controls as F19/F20. This supersedes the earlier unallocated intake/template backlog; technical decisions and development approval remain open.

## GitHub preparation

Commit `.gitignore`, `README.md`, `AGENTS.md`, `project-tracker.md`, and all Markdown files under `context/` and `docs/`. The root `.gitignore` excludes local secrets, dependencies, generated output, logs, temporary uploads/exports and local CodeGraph metadata. Sanitized `.env.example` / `.env.*.example` templates and the future pnpm lockfile remain eligible to commit. No blanket Markdown rule is used.

Repository creation and pushing to GitHub are a later step. This naming and repository-hygiene update does not authorize application development.
