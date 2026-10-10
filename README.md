# resume-forge

## UI release preparation — 2026-10-10

All pending Forge Studio UI, upload/template, device-theme and full-screen sign-in changes are prepared for the requested ux-ui-update PR integration. Fresh frontend tests: **85 passes** (shared 13, shell 15, profile 7, resume 50). Shared and all four frontend builds, affected lint and whitespace checks passed. Private runtime configuration, resume inputs and local data remain excluded. After merge, the active development branch becomes **fixes**; the existing frontend worktree and runtime locations remain the same. Dated local/uncommitted notes below describe earlier verification checkpoints.

## Full-screen ASCII sign-in — 2026-10-10

The signed-out **Forge Studio** scene now fills the viewport edge to edge. The old bordered hero box and outer spacing are removed. Resume workspace, the existing theme toggle and both footer messages sit inside the ASCII scene, alongside the wordmark and Google card. Desktop retains the two-column layout; tablet/mobile stack naturally and scroll when content needs more room. The sign-in static ASCII field covers the full scene on mobile/touch and reduced motion. The library's smaller fallback and existing activity guards stay unchanged.

Manual check: open `http://localhost:3000/sign-in` while signed out. Confirm the background reaches every edge, header/footer stay within it, and Google remains available. Resize to phone width: content should stack without horizontal scrolling. Theme controls still select the existing browser-local preference; Use device theme in Preferences restores device mode.

Verification: **15 shell tests**, shared/shell/auth lint, shared build and all four frontend production builds (including TypeScript) pass. Live dark-theme Chrome verifies a 1440×638 hero at x=0/y=0 with zero border/radius, and 320px/390px/900px responsive bounds. The final 390px static fallback has no canvas and fills the 844px scene; temporary viewport overrides were reset. Google OAuth, light-theme preview, backend/save/AI/PDF flows were not rerun for this layout-only slice. [Detailed evidence](docs/ux-ui-update-verification.md#full-screen-ascii-sign-in). Changes remain uncommitted on **ux-ui-update**.

## Device theme default — 2026-10-10

Forge Studio now uses the device’s light/dark preference on first visit. System mode follows `prefers-color-scheme` changes while the app is open. The existing theme icon selects a manual light/dark override, saved only in this browser under `resume-forge:theme`. **Preferences → Appearance → Color theme** offers **Use device theme**, **Light**, and **Dark**; choosing device mode clears the override. Blocked browser storage does not break the current visit, but manual choices cannot survive reload in that case. The resolved light/dark value still reaches every remote through the existing shell context. Initial theme is applied before React mounts; resume paper and saved PDF formatting remain independent.

Manual checks:

1. Open `http://localhost:3000`, then Preferences → Appearance → Color theme → Use device theme. A dark device should show dark UI; a light device should show light UI.
2. Change the device appearance while the app is open. Device mode should follow it. Choose Light or Dark explicitly, reload, and confirm that choice remains even when device appearance differs. The header/editor theme icon also saves a manual choice.
3. Select Use device theme again, reload, and confirm the current device appearance returns.

Verification: **15 shell tests pass**, including five new theme regressions for first visits, device updates/manual override/reset, reload persistence, invalid/blocked storage, and subscription cleanup. Shell production build (including TypeScript checking), lint and whitespace checks pass. Live Chrome on a dark device verifies the default, a light override across reload, the header toggle, and restored device mode across reload. Live OS appearance changes, standalone remote entrypoints and backend workflows were not retested. [Evidence](docs/ux-ui-update-verification.md#device-theme-default).

## Upload dialog, AI actions and template gallery — 2026-10-10

Implemented locally on **ux-ui-update**. **My resumes → Upload resume** opens a dialog over the library, without navigating first. File validation, extraction errors and editable review remain in that dialog; nested section editing works there too. Confirm and save uses the existing authenticated, idempotent create/version API, then opens the saved editor. Cancel before parsing saves nothing; closing an imported review asks whether to discard it. Closing during a save is guarded. The direct `/resumes/upload` route uses the same flow for compatibility.

**Improve with AI** uses the same Performative UI glow/sparkle action on the floating toolbar, manual edit dialog and AI request dialog. A solid white sparkle retains contrast in both themes. Opening an AI dialog still sends nothing; explicit submission, grounding, review and version checks are unchanged.

Shared dialogs now portal to a root overlay, escaping the scrolling inspector and paper paint layers. Background scroll is locked while open; the topmost nested dialog owns Escape and focus, visible controls form its Tab loop, and closing restores focus. The gallery has its own scroll area and an always-visible Done action.

**Template → Browse templates** offers **Forge Classic**, **Forge Modern** (Arial, indigo headings), and **Forge Editorial** (Times body, Georgia headings, wider margins). These are original single-column formatting templates using the current browser/PDF renderer, not new column layouts. Choosing changes only a draft's validated appearance. Undo/Cancel restores prior formatting; Save stores the exact settings in an immutable version, so future preset changes cannot alter an older PDF.

Template ownership lives in `apps/resume-mfe/src/templates/` inside the existing resume MFE. Add a versioned definition to `registry.ts`; the gallery discovers it automatically. No separate MFE deployment, dependency, backend schema or service is required for additional supported formatting styles. [Module guide](apps/resume-mfe/src/templates/README.md) explains the bounds and future layout boundary.

**Manual checks:**

1. Open `http://localhost:3000` and **My resumes → Upload resume**. Confirm the library remains behind the dialog and its URL stays the same. Try an empty file, then a valid PDF/DOCX/TXT/MD. Errors should allow another choice.
2. Review extracted text and edit a field. Escape from an inner Edit dialog must keep upload review open. Close the review; try Keep reviewing and Discard upload. Confirm and save should create one resume, then reopen it after refresh.
3. Open a saved project. Check the AI sparkle in light/dark on its floating action, Edit dialog and AI request dialog. Cancel should preserve content and saved version.
4. Open Template → Browse templates. Try Modern and Editorial: the gallery stays above the paper and shows selection. Done returns to the editor; Undo/Cancel restores formatting. Save, refresh and download PDF to check the saved style and content. Repeat at phone width.

**Actual verification:** 80 frontend tests (shared 13, shell 10, profile 7, resume MFE 50), shared/four MFE builds, five-package typecheck/lint and whitespace check pass. New template tests prove isolated settings, strict save-envelope round trips, unchanged facts, undo/cancel and honest custom-formatting labels. Chrome verifies both themes, 320px/390px bounds, modal focus/return, nested Escape, empty-file recovery, synthetic import/review/Confirm and save (version 1), Modern/Undo and Editorial save/reload (synthetic version 6). Editorial PDF downloaded through the native Save picker: 68,871 bytes, one page, project title/description retained. Chrome extension file-URL permission was unchanged; native picker testing bypassed the automation limitation without changing access. New Gemini generation/Apply, every file format/layout and broad accessibility/performance checks were not repeated. [Evidence](docs/ux-ui-update-verification.md#upload-ai-action-and-template-refinements).

## Forge Studio entry and editor refinements — 2026-10-10

Implemented locally on **ux-ui-update**. Signed-out visitors see a standalone **Forge Studio** sign-in with Performative UI's AsciiHero and a large wordmark; workspace navigation appears only after verification. Google sign-in and authenticated visits to `/sign-in` open the server-selected **My resumes** route directly. Session verification shows loading instead of flashing the welcome. **Preferences → Account → Sign out** remains available, including the existing failed-logout recovery.

Saved-resume search now uses a quiet field and normal Search button. The selected-entry **Improve with AI** button uses Performative UI's glow and sparkle and keeps its existing scoped dialog. The builder removes the read-only A4/page-count and Fit-to-width strip, uses a neutral outer paper surround, and retains actual automatic fit-to-width sizing. Real document margins and PDF formatting are unchanged. Editor entry now starts in its loading state instead of briefly showing an empty Resume unavailable error. Navigation uses a short fade; reduced motion disables it and the animated ASCII field.

**Manual checks:**

1. At `http://localhost:3000`, open Preferences and sign out. Confirm no workspace sidebar, a large Forge Studio heading and ASCII sign-in artwork in both themes.
2. Continue with the existing Google account. Confirm My resumes opens with its sidebar. Visiting `/sign-in` while signed in should return to My resumes.
3. Search for **Forge UI QA**. Both Search and Enter focus Saved resumes; the search button has no AI sparkle or glow.
4. Open **Forge UI QA (Synthetic)**, select its project, and inspect the glowing Improve with AI action below that entry. Open its dialog and Cancel; saved version 5 should remain unchanged.
5. Check light/dark and narrow widths. No A4/Fit-to-width labels should appear; paper still fits its available width. Preferences → Reduce motion stops the navigation fade and uses static ASCII.

**Verification:** 78 frontend unit tests, shared and all four frontend builds, five-package typecheck/lint and `git diff --check` pass. Chrome verified actual sign-out/Google sign-in/direct authenticated entry, Search and Enter, scoped AI dialog/Cancel, centered entry toolbar, both themes, 320px/390px fit and reduced motion. No new AI generation, save mutation, file import or completed PDF download was needed for this refinement. [Detailed evidence](docs/ux-ui-update-verification.md). Changes remain uncommitted.

## Forge Studio design — 2026-10-10

Implemented the approved Studio direction locally on **ux-ui-update**, after the preceding rewrite fixes merged into main through [PR #4](https://github.com/resuming-v2/ResumeForge/pull/4). This supersedes the earlier ocean/teal redesign. Charcoal and violet dark surfaces pair with soft violet light surfaces. Sora headings and DM Sans controls distinguish the application while saved resume typography and white PDF paper remain independent.

**My resumes** now has a full-width ASCII spotlight with Upload/Create above the saved list. Performative UI's AsciiHero, PromptHero, Prompt, Temperature, NodeGraphBackground, ChatBubble and TokenStream join the existing shared adapters. The editor puts paper left and a compact inspector right, with **Content / Template / Review**, **Editor / Preview**, and **Focus** controls. Review contains **ATS readiness / Tailor to job**; duplicate JD navigation is removed. Score displays remain read-only, rule groups retain exact-entry Fix/View/Dismiss/Restore, and secondary actions collapse. AI reviews retain red removals, green replacements and explicit versioned Apply. TokenStream reveals a validated response notice after the result arrives; it does not simulate server streaming.

The change preserves existing APIs, authentication, saved-version checks, scoring weights, fact validation, Tiptap and native dialog focus handling. No backend, database, credential, dependency or printable-document change is included. Animated backgrounds unmount on mobile/touch, reduced motion, hidden tabs and offscreen views. [Design and component constraints](docs/ux-ui-update-plan.md), [actual checks and limitations](docs/ux-ui-update-verification.md).

### Check Forge Studio

The personal stack runs at **http://localhost:3000**. If stopped, start it from the frontend worktree; do not start a second stack over occupied ports.

```sh
cd /Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2
RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 pnpm dev:personal
```

1. Open **My resumes**. Upload/Create sits above saved resumes. Search through the PromptHero field; sort and existing PDF/delete icon actions remain available. Delete asks for the named document and offers Undo.
2. Open **Forge UI QA (Synthetic)** or create your own test resume. The workspace sidebar hides. **All resumes** restores it. Edit a field, blur it, then **Save changes**; reload to check the stored version.
3. Switch between **Content**, **Template** and **Review**. **Focus** hides the inspector; **Show tools** restores it. **Preview** hides editing actions. Paper defaults to Fit to width in both themes.
4. Review **ATS readiness**. Expand a rule, inspect its Reason and use Fix for its exact target. Open **Tailor to job**, edit the JD and select Local rules or Gemini + rules. Short JDs remain editable while Analyze is disabled. Click Analyze, or press Cmd/Ctrl+Enter, to compare the saved version. Existing unsaved-edit guards still apply.
5. Select one saved project/work entry and **Improve with AI**. Submit explicitly, review removed/replacement words and full original/suggested text, then Cancel or **Apply and save version**. Only the reviewed target may change. No-change/error states remain visible.
6. Switch light/dark and enable **Reduced motion** in Preferences. At 320px/390px, check tools, library and dialogs without horizontal page overflow. ASCII/NodeGraph use static mobile and reduced-motion fallbacks; paper stays white.

Verification: **77 unit tests**, all four frontend builds, five-package typecheck/lint and whitespace checks pass. Browser checks cover library search, sidebar return, Focus, themes, 320px/390px editor layouts, local JD submission, synthetic save/reopen, Gemini no-change/replacement review and Apply. Forge UI QA is now saved at **version 5**. Normal Google sign-in recovery also succeeded. Sign-out, a new real-file browser import, completed downloaded PDF contents and full accessibility/performance audits were not exercised. UI changes remain uncommitted.

## Project rewrite shorthand fix — 2026-10-10

Fixed on **features**. The supplied final CV reproduced two false rejections: singular `app` had no `application` equivalent, and `UI` could not expand to the complete phrase `user interface`. Prompt and validation now support both exact equivalents. Singular/plural application terms stay separate, and the words in `user interface` must remain adjacent. Invented factual vocabulary, removed source facts, changed numbers, negative wording, slash-separated technologies and cross-field edits still fail validation. No model, timeout, permission or persistence behavior changes.

Verification: **86 resume-service unit tests**, the service build, lint and `git diff --check` pass. Synthetic regressions cover singular/plural preservation, complete phrase expansion, unsupported claims and selected-bullet Apply isolation. Live Chrome testing of both projects in the supplied final CV now reaches Suggested changes with inline removals/replacements. Both reviews were canceled; reload confirms **saved version 1** and both original project descriptions. Temporary diagnostic instrumentation was removed; no real resume fixture or credential is added to Git. This repair was verified locally before its requested PR integration.

Manual check: reload `http://localhost:3000`, open the saved final CV, select the first project and click **Improve with AI**, then the same button in its dialog. Review the singular app/application replacement. Cancel, repeat for the second project, and review the UI/user interface replacement when suggested. Cancel preserves the version; use **Apply and save version** only after reviewing your facts. AI may return no changes when wording already satisfies the bounded rules.

## Release verification — 2026-10-10

This release consolidates saved resume PDF/library actions, local readiness and JD scoring, scoped paid Gemini analysis and reviewed rewrites, private version-bound vector retrieval, alternate-layout PDF import fixes, and inline replacement reviews. Previous local/uncommitted notes below are retained as dated implementation history.

Before publication, the release passed **153 unit tests**, **19 restricted editor database tests**, and **12 runtime-role database checks**. Resume-service, gateway and workspace-service dependency builds and the resume-MFE build passed; resume-core, shared-types, prisma-client, resume-service, gateway and resume-MFE lint passed. `git diff --check` and the candidate-file/private-credential scans passed. Private environment files, real resume inputs, generated files and local database data are excluded from Git. Publishing source does not apply migrations or configure hosted services; deployment instructions remain in [vector search](docs/resume-vector-search.md).

## Gemini rewrite repair and inline review — 2026-10-10

Fixed locally on **features**. The final CV's selected Full Stack Developer request reached Gemini but failed our validation: harmless `auth` → `authentication` and action-word inflections were treated as new facts. Prompt and validator now share a bounded grammar/action vocabulary and two explicit shorthand equivalents (`auth`/`authentication`, `apps`/`applications`). Other factual vocabulary, numeric claims, negative wording, slash-separated technology terms, field IDs, contact exclusion and current-version authorization remain guarded. These checks reduce unsupported edits; they do not prove semantic equivalence, so review remains required.

The AI request and JD panels have **no consent checkboxes**. Improve with AI is the explicit processing action; JD methods use **Local rules** and **Gemini + rules** buttons. The scope note remains visible. Browser requests send only saved version/target/processing intent, and the server retrieves the selected description/visible achievements. The rewrite provider receives field IDs and text only, not the whole document, contacts, titles, dates or other entries. Gemini-assisted JD analysis still uses the broader professional-only projection and private version-bound embeddings; it is not a selected-entry rewrite. Professional descriptions can themselves contain personal information; we do not claim that all resume wording is non-personal. No request runs merely from opening a dialog or selecting a method.

**Suggested changes** displays word-level red strikethrough removals and green underlined replacements, with unchanged text between separate edits. Each field has an expandable Original/Suggested view, accessible change labels, Cancel and explicit **Apply and save version**. Very large diffs fall back to a bounded full replacement comparison. Cancel and failure preserve the saved document; Apply remains an authorized, idempotent immutable-version transaction.

Paid **gemini-3.5-flash-lite** stays pinned ([official model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)). Generated requests now allow **20 seconds** and rewrite output up to **8,192 tokens**, matching the existing 12,000-character input bound more safely. Analysis keeps 1,800 output tokens, embeddings keep eight seconds, two active provider requests and response byte limits remain. No expensive-model fallback or automatic retry was added. Credentials, database schema and roles are unchanged.

Verification: **153 unit tests** (core 15, gateway 6, service 84, resume-MFE 48) and **19 restricted disposable database tests** pass; affected service dependencies and MFE build, service/MFE lint, and `git diff --check` pass. New regressions cover safe shorthand/inflections, rejection of invented/dropped facts and altered technical terms, timed aborts, scope-only request payloads, multiple replacements, Unicode/line breaks and bounded long diffs. Live final-CV review returned suggestions; Cancel left it at version 1. On **JD Workflow QA (Synthetic)**, test preparation saved version 4, reviewed Apply saved exactly version 5, reload retained the chosen description and unchanged second job/project. At 390px, the AI dialog has equal client/scroll widths of 356px. JD methods have zero checkboxes; live Gemini JD recheck returned 67/100 on saved version 5. Changes remain uncommitted.

### Manual check

1. Reload `http://localhost:3000`, open a saved resume, select Summary or one Work experience/Projects entry, then **Improve with AI**. Saved content is required; save pending edits first.
2. Click **Improve with AI** in the dialog without ticking anything. Verify replacements beside the struck-through original words. Open **Read original and suggested text** to compare complete values. Verify technologies, quantities and responsibilities before applying.
3. Cancel first and check the saved version did not change. Request again, use **Apply and save version**, reload, and check only the selected entry changed and the version increased once. Unsupported/malformed responses remain errors, not accepted changes.
4. Open **Optimize for JD**, select either **Local rules** or **Gemini + rules**, and click Analyze/Recheck. No consent checkbox is required. Local rules send no AI request; Gemini uses the documented professional projection. No score increase is promised by a wording edit.

```sh
cd /Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2
pnpm --filter @resume-forge/resume-service... -r build
pnpm --filter @resume-forge/resume-mfe build
pnpm --filter @resume-forge/resume-core --filter @resume-forge/resume-service --filter @resume-forge/gateway --filter @resume-forge/resume-mfe -r test
RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 pnpm --filter @resume-forge/resume-service test:editor:db
pnpm --filter @resume-forge/resume-service --filter @resume-forge/resume-mfe -r lint
```

## Alternate-layout import and no-JD rule cards — 2026-10-09

Fixed on **features** in the frontend worktree. The supplied alternate-layout PDF has two independent text columns. Extraction previously joined rows across those columns, mixing work into projects/skills and losing section boundaries. A conservative persistent-gutter check now reads independent narrative columns separately; right-aligned dates alone do not become another column. Parsing also supports Personal Profile headings, company-before-role entries, date/location metadata, numeric month/year ranges, bullet glyphs without following spaces, standalone skill categories, commas inside skill qualifiers, inline CGPA and paired language/proficiency rows.

The private supplied file now retains **six sections**, **three jobs** with **3/2/1 bullets**, **two projects** with **4/4 bullets**, **one education entry**, **four skill groups / 12 items**, **four language/proficiency pairs**, both profile links, contact location, date months and CGPA. All 14 work/project bullets survive the editor adapter and a strict save-envelope round-trip. The older single-column sample still retains its three jobs, two projects, education, summary and skills. Real files remain private local inputs; committed regression tests use invented facts. Previously saved imports are never rewritten by the parser fix: upload again and review a new copy.

**ATS Score → Resume readiness** now uses compact rule cards, with **13 families** on a populated resume instead of dozens of repeated entry cards. Pending/Completed/Deleted count families in that tab; each check keeps its own exact target and dismissal preference. A family completes only when all its instances pass. A family can appear in Pending and Deleted when different entries have different statuses; dismissed entries remain restorable after reload. Fix opens the selected role/project/header/education/skills editor with its reason, Go to field and the existing reviewed Gemini description flow where supported. No AI call is made by opening a rule.

New **Advice** checks cover 2–6 visible bullets, explicit technologies/tools, education completeness where applicable, at least five supported skills, selective bold in long editor descriptions, and essential contact presence. These are **score-neutral**. The approved 25/25/20/15/15 weights and original weighted rules are unchanged; no unsupported fact should be added to gain points. The extended assessment is **readiness-v2**; v1 history remains readable and automatically refreshes on the same saved version. Contact values remain outside resume-core, JD/provider inputs and returned assessments; the adapter supplies only one contact-completeness boolean. JD scoring/feedback keeps its existing rubric. The score details and breakdown share one collapsed disclosure.

The editor uses **shadcn-based shared primitives and Tiptap**. Performative UI remains installed for existing app surfaces; these rule cards add no Performative decoration or UI dependency. The CareerZenith screenshots informed visible rule/action capabilities only. Its private score formula, weights and rating thresholds are unknown.

### Verification and manual checks

Core **15/15**, resume-service **81/81**, gateway **6/6**, resume-MFE **44/44**: **146 unit tests**. Disposable restricted editor database **19/19**, including same-version legacy rubric refresh, immutable history and stale-preference denial. Service dependencies and resume-MFE build; the four affected packages lint. Real PDF extraction/editor round-trip and the older PDF regression pass. Browser checks verify header Fix/focus, second-job Fix, persistent per-entry Dismiss/Restore, unchanged score and all-pass family completion. At a 390px viewport, the panel/document widths are 390px and the Fix dialog is 356px with no horizontal overflow. Browser upload of the real PDF was blocked by the Chrome extension's file-URL permission; no live real-file upload/save is claimed. No permission, credential, database role or schema change is needed.

```sh
cd /Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2
pnpm --filter @resume-forge/resume-service... -r build
pnpm --filter @resume-forge/resume-mfe build
pnpm --filter @resume-forge/resume-core --filter @resume-forge/resume-service --filter @resume-forge/gateway --filter @resume-forge/resume-mfe -r test
RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 pnpm --filter @resume-forge/resume-service test:editor:db
```

1. In the running app at `http://localhost:3000`, choose **My resumes → Upload resume** and select the final CV from `check_resumes`. Automated Chrome upload additionally needs **Allow access to file URLs** on the ChatGPT browser extension; manual file selection does not need this automation permission. Review all six sections, 14 job/project bullets, 12 skills, four language levels, months, grade and links before confirming. Give the copy a distinct title, save, reload and reopen; verify the same values.
2. Open **ATS Score → Resume readiness** with no JD. The final CV's locally converted document scores **97/100** under the unchanged weighted rules; this is not a CareerZenith score, PDF parsing guarantee or hiring prediction. Review pending project-context, bullet-volume and technology advice. Expand a rule, click **Fix** on the second job, and confirm that job's own fields. Use **Go to field**, Cancel, or save supported edits; then recheck the saved version.
3. Dismiss one entry within a multi-entry rule, reload, open **Deleted**, and **Restore** it. Verify the score stays unchanged and the other entries remain pending. In **Completed**, no family with a failing entry should appear. Check a new empty resume still scores 0; contacts, skill count and education advice do not fabricate score points.

Text extraction does not preserve the original PDF fonts, bold emphasis, decorative layout or language rating dots. Bold advice checks editor rich text only. Conservative column recognition is verified for the supplied layout, not every multi-column design; OCR/scanned PDFs and broader import provenance remain pending. Current changes remain local and uncommitted.

## Private vector retrieval — 2026-10-09

Implemented locally on **features**: optional Gemini JD analysis now retrieves professional evidence from PostgreSQL/pgvector. Each visible experience/project entry becomes a private, version-bound `gemini-embedding-001` vector with **768 dimensions**. Ownership, current version, model and projection are checked before retrieval; save/delete purges derived cache. Contacts, hidden fields and extraction source are excluded. Fixed backend rules still own numeric scores; cosine similarity never earns points alone. Local scoring needs no AI call.

The supplied resume was imported into **Data Engineer JD QA — imported copy** and tested against the supplied Data Engineer JD. Live paid Gemini analysis returned **36/100**, with **5 indexed entries** and **12 evidence candidates**. Reload preserved the saved resume, JD and assessment; the version-1 PDF downloaded successfully. The original existing resume was preserved. General readiness returned 100/100 for basic rules, which does not mean a strong match for this JD.

The local additive migration and restricted cache/function grants are applied. Source resume/version counts and existing passwords were preserved. Current search ranks exactly within at most 40 entries; an HNSW index exists for later larger authorized corpora, but production scaling and cross-resume/HR search are pending. No AI training dataset or model fine-tuning is built.

[Architecture, privacy, migration/rollback and manual vector checks](docs/resume-vector-search.md). [Scoring and scoped Gemini rewrite review](docs/ats-workflow.md). Current work remains local and uncommitted; prior dated sections below preserve earlier verification history.

## JD matching and scoped AI fixes — 2026-10-09

Implemented locally on **features**. **ATS Score → Resume readiness** keeps the no-JD check. **ATS Score → JD match** and **Optimize for JD** now compare a saved resume with a pasted JD. The server owns the user-approved `jd-local-v1` weights: required keywords **30%**, experience relevance **25%**, skills **20%**, structure **15%**, readability **10%**. These are internal heuristics, not an employer ATS score or hiring prediction. Missing JD criteria produce a partial assessment with no overall score. Technology labels support keyword/skill matching without counting as achievement descriptions.

Optional paid **Gemini `gemini-3.5-flash-lite`** checks semantic correspondence. Its quotes and target IDs must match the saved professional content; it never supplies the numeric score. Wording uses a separate scoped operation on the same model. Consent is required before each requested analysis. The saved version, JD, weights, method, hashes and evidence survive reload. Editing the resume, JD or analysis mode marks evidence outdated and disables its actions until rechecked. Dismiss/Restore changes feedback visibility only.

**Fix** opens the matching experience/project entry, its description and guidance. **Improve with AI** uses paid **Gemini `gemini-3.5-flash-lite`** through the server provider boundary, with explicit per-request consent. The review shows Original/Suggested text; **Apply and save version** applies only the stored selection and creates one immutable database version. Contacts, unrelated entries and the master profile are excluded. Empty descriptions require real facts first. Cancel/provider failures preserve content; stale suggestions fail instead of overwriting later edits. The old timed local AI preview is removed from the real editor.

**Current provider:** Gemini 3.5 Flash-Lite serves JD evidence and selected wording with minimal thinking. Standard pricing checked 2026-10-09: $0.30 input / $2.50 output per million tokens ([Google pricing](https://ai.google.dev/gemini-api/docs/pricing)). OpenCode SDK/process/HTTP code and dependency, plus the unused Textkernel runtime/tests, are removed. Stored legacy proposals/results remain readable. This supersedes previous OpenCode setup and blocked-rewrite notes.

**Compact panels:** ATS feedback is grouped into five areas instead of approximately 45 individual cards. Tabs count areas; the exact check count and all original scoped actions remain available inside them. Weights and score math are unchanged. Optimize for JD collapses the saved JD editor, score breakdown and evidence, keeping the score and actions visible first.

### Verified Gemini and compact-panel checks

Core **14/14**, resume-service **76/76**, gateway **6/6**, resume-MFE **40/40**: **136 unit tests**. Restricted disposable editor database **18/18**. Six affected packages build/lint successfully; frozen offline installation and diff checks pass. The retired OpenCode/Textkernel adapter tests are removed; new tests cover project-targeted JD evidence, legacy proposal compatibility, model-cache refresh and compact groups retaining exact check targets.

Live paid Flash-Lite returned a grounded synthetic rewrite and JD quote. The imported QA copy retains version 1 and a reloaded **36/100** JD result with five reused embeddings; its selected real experience returned no changes. **JD Workflow QA (Synthetic)** advanced version 2→3 through reviewed Gemini Apply; reload preserved the selected rewrite and unchanged second experience/project. Prior JD evidence becomes stale. The review dialog fits a 390px viewport; JD has no horizontal overflow. Original real resume content is preserved.

Readiness remains a basic heuristic: shortening the synthetic description reduced its length-based readiness 43→36. A wording improvement is not guaranteed to increase that score. Review suggestions and recheck the JD; AI must not pad descriptions or invent facts to gain points. Broader scoring calibration/corpus quality, PDF parsing checks and production jobs remain pending. [Detailed workflow](docs/ats-workflow.md).

### Setup and manual checks

Keep `GEMINI_API_KEY` only in the original project's ignored `.env`. Set `GEMINI_DATA_MODE=paid` in ignored `.local/ai-provider.env`; paid mode is already configured. No OpenCode key, SDK or CLI is needed. Restart the existing personal runtime after changing environment values; avoid starting a second stack over occupied ports.

```sh
cd /Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2
RESUME_FORGE_LOCAL_ROOT=/Users/nishankbansal/Downloads/ResumeBuilderv2 pnpm dev:personal
```

1. Open `http://localhost:3000`, sign in, create/reopen a resume, add supported descriptions and **Save changes**. Blank resumes retain readiness 0; AI cannot invent missing experience.
2. Open **Optimize for JD**, paste at least 50 characters with responsibilities and required/preferred skills, then **Analyze this JD**. Expand **Score breakdown** and **Skills & responsibility evidence** to inspect the result. The JD editor collapses after analysis; expand **Edit job description & recheck** to change it. With unusable criteria, expect **Partial assessment**, not a fabricated total.
3. Reload/reopen and verify the saved version, JD and assessment remain. Edit the JD or resume: expect **Needs recheck** or a save-first message. Recheck after saving.
4. Enable **Add Gemini semantic analysis**, confirm sending professional text, then analyze. Expect **Gemini evidence + fixed rules**. Use the local mode without external calls whenever preferred.
5. Expand **Experience & projects**, then click **Fix** on an experience/project issue. Verify the entry title and its own description, including the second entry in a multi-entry resume. Click **Improve with AI**: only that description/visible achievements appear; submission requires consent. Consent sends only saved selected professional text to Gemini. Provider failures show a safe error and keep the version unchanged.
6. Review Original/Suggested text, Cancel without changing content, or **Apply and save version**. Reload and verify the new version and unrelated entries. A concurrent save must reject the old proposal. JD evidence then needs rechecking; general readiness automatically checks the new version.

A **JD Workflow QA (Synthetic)** resume remains in the local library with two experiences and one project. That earlier verification used synthetic content; the later authorized real-resume vector check is recorded above. [Implementation, API, limits and verification](docs/ats-workflow.md). These changes remain local and uncommitted.

## General resume readiness — 2026-10-09

Implemented on **features** in the frontend worktree. The **ATS Score** panel now runs an authenticated, deterministic **general readiness** check without a JD or AI provider. This supersedes the earlier placeholder-meter statements below. It is an internal heuristic, not an employer ATS score, acceptance prediction, job match or PDF parsing test. A 100 score means these basic rules passed; it does not establish the resume's factual quality or suitability for a job.

The user approved these `readiness-v1` weights on 2026-10-08:

| Component           | Weight | Checks                                                                                                                                                     |
| ------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structure           | 25%    | Visible background and skills, distinct populated headings, at least two populated sections. Summary and paid employment are optional.                     |
| Experience detail   | 25%    | Experience/project titles, context subtitles, and at least one description or achievement with eight words. Projects can supply experience evidence.       |
| Skills presentation | 20%    | Visible skills, category labels, normalized duplicates and concise items. More keywords do not earn extra points.                                          |
| Achievement clarity | 15%    | Every visible statement in an experience/project entry has 8–60 word tokens. Metrics are optional. No grammar, truth or impact judgment.                   |
| Date consistency    | 15%    | Complete ranges, chronological order and consistent Present. Year-only ranges are allowed; undated projects are optional. No gap or future-date inference. |

Each component is the rounded percentage of passed checks; the total is the rounded weighted sum. Empty professional content scores 0. The server scores visible professional fields from the current immutable saved version. Header/contact fields, original extraction text, hidden content and appearance are excluded from this projection. No third-party transfer occurs, and assessment feedback contains generic reasons and stable target IDs rather than raw resume text. The master profile and UserContact are unchanged.

Results store resume/version IDs, a contact-free input hash, timestamp, rubric, components and check outcomes in private `Resume.atsBreakdown.readiness` metadata. Running a check does not create or rewrite a content version; legacy JD `atsScore` stays separate. Opening a saved editor selects ATS Score and automatically checks a missing or outdated assessment. Saving changes marks the previous assessment outdated until the automatic check succeeds; failure retains that label and offers Retry. Repeating a check on the same version/input returns the same assessment. Assessment and feedback writes update record metadata time, so the library's update time can reflect these actions too.

**Fix** opens the target's manual editor with its issue title, reason, live check status and **Go to field** focus action; a global rule opens Edit Content with guidance. **View** selects the target. **Reason** is an accessible expandable explanation. **Deleted** means dismissed feedback and supports **Restore**; dismissal never changes the score. **Completed** shows every passing check in the displayed assessment, including initially passing checks. Removed rules/targets are absent, rather than counted as resolved.

Manual dialog candidates and applied draft edits use the same pure scorer/projection in the browser and display **Unsaved preview**, including live component and action counts. Inline text contributes after its normal blur/Enter commit. Preview does not write an assessment, save content, change the master profile or send data to a provider. Cancel restores the previous preview. A clean saved editor shows only its persisted version-bound result. Persisted recomputation and dismissal/restore stay disabled while edits, dialogs, conflicts or saves are pending. Manual Fix/View remain available between unsaved edits, but close the active dialog first.

The local implementation retains up to 100 immutable assessments per resume and at most 2,000,000 serialized metadata characters; reaching either limit fails visibly without deleting history. Feedback displays the first 100 checks with a truncation warning, while score math uses every check. The API returns the latest and preceding assessment; a historical assessment picker is not built. Shared workspaces, PDF parseability checks, semantic JD matching, durable scoring jobs and AI explanations remain pending. JD scoring and scoped provider adapters are now implemented as described above; no AI credentials are needed for general readiness.

### Manual readiness check

1. Start the personal runtime with the startup command below. Open **My resumes**, create or reopen a resume. **ATS Score** opens with automatic checks; no JD, AI credential or Run click is needed. A blank resume scores 0 under our rubric.
2. Expand **Score breakdown** or **Assessment details** for weights, version and timestamp. **Completed** shows five areas containing all passing checks. Expand an area, then **Reason** to inspect a rule.
3. Click **Fix** on a targeted rule. Verify its guidance appears in the manual dialog, then click **Go to field**. Change a supported field: **Unsaved preview** and the guidance update. Cancel/discard the dialog and verify the prior preview returns.
4. Apply dialog changes to the local draft. The preview stays labeled unsaved; PDF and persisted scoring/preferences stay disabled. Click editor **Save changes** and wait for **Evaluated** on the new version. It should equal the preview for the same visible professional facts.
5. Reload or recheck without editing. The same assessment/timestamp should remain. Click **Dismiss** on a pending rule: Pending decreases, Deleted increases, and score stays unchanged. Reload, open **Deleted**, then **Restore**; the feedback returns without a score increase.
6. Use a disposable resume for two-tab saves or network failure testing. Stale requests must fail rather than overwrite evidence. A failed automatic check retains the old version label and allows **Retry readiness check**; content saves remain separate.

A **Readiness QA (Synthetic)** record was created for live testing and remains in the local account at version 3. It contains synthetic identity, one explicitly synthetic skill, and no contacts. Its score is 33 with six passing checks. A newer **ATS Flow QA (Synthetic)** record also remains for this workflow verification. Use these records for manual feedback checks. Existing real resume content was not edited.

The signed-in Chrome comparison observed CareerZenith scoring without a JD, initially passing Completed checks and contextual Fix dialogs. Our implementation matches those interactions with our approved rubric. Its private algorithm, score weights and thresholds cannot be recovered from the UI. Contact completeness, appearance/link validation, provider-backed rewrites and JD matching are outside this slice. [Reference observations](docs/careerzenith-ats-comparison.md).

Verification commands, actual browser results and remaining test limits are in the [tracker](context/progress-tracker.md#general-readiness-scoring--2026-10-09). These changes remain local and uncommitted.

## Current development task

<!-- BEGIN:CURRENT_TASK -->
```json
{
  "status": "idle",
  "task": null,
  "owner": null,
  "startedAt": null,
  "updatedAt": "2026-10-10T19:28:16.149Z",
  "lastResult": "Full-screen ASCII sign-in; header/footer inside; responsive static fallback. 15 shell tests, lint, shared/four frontend builds and browser bounds pass."
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

## Saved resume label — 2026-10-08

The library now labels persisted editable resumes **Saved**, rather than **Draft**. The API's `draft` lifecycle means an editable document; it is independent of storage. Creating or confirming an upload stores version 1, and each successful **Save changes** stores the next immutable version and advances the update time. A failed/conflicted save keeps the previous version; unsaved browser edits do not change the library record. Generation states remain visible. Saving does not declare a document complete, ATS-ready or generated, and no database status migration is required. Existing saved drafts receive the corrected label when the list reloads.

Manual check: save a resume and wait for **Saved version N**, then click **Back to all resumes**. Its row must show **Saved**, **Version N** and its updated time. Reload the library and reopen the same resume; the saved fields must remain. Make an unsaved change and discard it before leaving: the row must still show the last acknowledged saved version. Save errors must retain edits and must not advance the row version.

Verification: resume-MFE build and lint passed. Live Chrome checked existing version 1/version 3 labels, reopening version 3, returning to the list and reload persistence. No stored resume content was changed during this label check.

## Delete resumes and download saved PDFs — 2026-10-08

Implemented on **features** in the frontend worktree. This section supersedes earlier statements that deletion and PDF downloads are unavailable in the personal editor.

- Click a resume name to open its editor. Each saved row has icon-only **Download PDF** and **Delete** controls, with tooltips and screen-reader labels; the separate Open button is removed. PDF preparation displays a loading icon and exposes its busy state. Delete opens an accessible confirmation naming the resume and saved version. Cancel leaves it unchanged; failed deletion keeps the confirmation open with a readable error. Success removes only that row and moves keyboard focus to the list heading.
- Deletion is a recoverable database tombstone (`status = deleted`). The latest deletion offers **Undo delete** while the library page remains open; Undo restores it as a draft without changing its immutable content/version. Reload still excludes deleted records. Loading, saving, recreating the same ID and exporting deleted records are denied. This is not permanent erasure: immutable versions and audit events remain retained. Trash browsing, purge/retention policy and object-storage cleanup are not implemented.
- **Download PDF** in the editor and **PDF** in the library render the latest saved immutable version on the server and download real PDF bytes privately. Unsaved edits and open edit/AI dialogs disable editor export; save first. Upload review must be confirmed and saved before export is available. If another tab saves or deletes during rendering, the server rejects retrieval instead of silently downloading stale content.
- Output has selectable text, A4 pages, saved margins/type settings, supported bold/italic text, links, dates, entries, achievements, skills and languages. Hidden content, empty sections, input placeholders, source extraction text, ATS controls and unapplied suggestions are excluded. Long content paginates without shortening it. The PDF renderer is separate from the HTML preview; exact line wrapping and page count can differ.
- This is an authenticated personal-owner export of that user's private saved resume, including its resume-local contacts. No public URL, provider upload or shared-workspace export is enabled. Actor, ownership, workspace, version and expiry are checked before rendering and again before retrieval. Sanitized audit capture must succeed. No database migration, new grant or credential change was needed.
- Pinned renderer: `@react-pdf/renderer` 4.9.0 with React 19.3.0. Local macOS system fonts match the editor; portable deployments use bundled Noto Serif/Sans fallback fonts, whose metrics can differ. Font characters are checked before rendering; unsupported glyphs produce an error instead of missing text. Two isolated workers, 25-second rendering timeout, 256 MB worker heap, 200,000 rendered characters and 15 MB output cap bound each request. Gateway/session PDF timeout is 30 seconds. The full F09 R2/cache/durable-task/shared-variant pipeline remains pending.

### Manual deletion and download check

1. Open [the local app](http://localhost:3000/), sign in, and open **My resumes**. Create a disposable test resume, enter your intended fields, and click **Save changes**. Wait for **Saved version N**. Download using **Download PDF**; finish the browser's Save As prompt if enabled. Open the file and select/copy its text. Confirm visible fields and page breaks.
2. Change text without saving. **Download PDF** must be disabled. Save it, then download again; the filename includes the new version. Hidden sections/achievements must be absent. Cancel an upload review; it has no downloadable saved resume.
3. Return **Back to all resumes**. Click the row's **Download PDF** icon; it downloads that row's latest saved version. If another tab changed it, refresh the list and retry after reviewing the current version.
4. Click the **Delete** trash icon on the disposable test row. Confirm its name/version, then **Cancel**; it stays listed. Repeat and click **Delete resume**; it disappears. Click **Undo delete** before leaving the page; it returns with the same saved version. Delete again, then reload: it stays absent and its old editor URL cannot load it. Only use a disposable resume for this last check; the current UI has no trash browser after reload.
5. Keyboard users can Tab through row actions, Cancel/confirm in the dialog, and Undo. Check the 390px layout: the clickable resume name and both icon actions remain reachable.

### Verification

Final commands and browser/PDF evidence are recorded in the [tracker](context/progress-tracker.md#saved-pdf-downloads-and-confirmed-deletion--2026-10-08). No commit, push or deployment is implied by these local changes.

## Editor sidebar, ATS meter and section actions — 2026-10-08

Work is on **features** in `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2`. This frontend correction supersedes the earlier Fit page/100% controls, desktop header actions and mobile bottom dock described below.

- The first workspace sidebar is hidden on resume editor/intake routes. **Back to all resumes** restores it with the existing expanded/collapsed preference. The editor's own tool rail remains available. No sidebar preference is written to browser storage.
- The paper now defaults to **Fit to width**, with no zoom buttons or percentage control. A stable ResizeObserver measures width and content height; hover/selection no longer reinitializes it or changes scale according to header height. Fixed 794 × 1123 A4 geometry, overflow notices and all resume content remain intact.
- **Improve with AI** and the existing Edit/Move/Hide/Delete controls are centred 6px below the selected entry in Work experience, Education or Projects. Hovering an achievement uses its enclosing entry's footer. Section headings and Summary keep a section footer; hovering the first, second or third experience moves the bar to that individual experience. This is an overlay outside the scaled document, so it adds no printable gutters or saved formatting. Phone screens use the same target position with 44px touch targets. Skills continues to open its category dialog.
- Hover selection waits 150ms so the pointer can cross the following section and reach the toolbar. Entering the toolbar, leaving the paper, selecting by click/keyboard, or opening a dialog cancels pending hover selection. Selection and actions do not resize the header or paper. Preview hides the toolbar; dialogs restore focus to the contextual actions.
- **ATS Score** has an original calibrated 0–100 meter, explicit **Not evaluated** state and an unavailable-score label. **Run ATS check** remains disabled because scoring is not connected to this personal editor. Suggested-action filters explain the unavailable evaluation. No numeric score, rating threshold, issue count or completed action is invented. This UI adds no API, rubric, provider, database migration or saved version.

### Manual controls check

1. Reload [the local app](http://localhost:3000/), then open a saved resume or click **Create resume**. The workspace sidebar disappears; the editor tool rail remains. Expect **A4 · 1 page** for a compact draft and **Fit to width**, without Fit page, Fit width or 100% buttons.
2. Move the pointer across the blank resume's Summary, Work experience, Education, Projects and Skills. The page/header must stay steady. Hover briefly on a section or click its text. Hover each Work experience entry: actions must follow the bottom centre of that individual entry, including when hovering its bullets. Projects and Education entries behave the same; heading/Summary selection uses the section footer. Move to **Improve with AI**; it must remain reachable and open the Projects preview dialog. Cancel without accepting.
3. Open **Edit selected content**, then Cancel. Focus returns to that action. For an empty Projects section this opens a temporary new-entry form; Cancel must keep the saved blank resume unchanged. Switch **Preview** and back: actions disappear in Preview and A4 layout remains the same. View-only actions leave **Save changes** disabled.
4. Open **ATS Score**. Expect the empty calibrated meter, **Not evaluated**, **— / 100**, and disabled **Run ATS check**. Pending, Completed and Deleted each display the corresponding unavailable-actions state. These controls do not run a real evaluation.
5. Click **Back to all resumes**: the workspace sidebar returns. Collapse it, reopen a resume, and go back again; the 72px collapsed preference must return. On a phone, verify there is no extra workspace navigation row while editing. The ATS meter and section actions must fit the screen.
6. Reopen the corrected import and compare populated fields, dates, links and Skills. Collapse/reopen the tool panel and scroll through the document. Customize Template, ATS Score, Optimize for JD and Collapse remain distinct controls. Unsaved content still requires Save changes or explicit discard before leaving.

### Controls verification

Editor info messages now omit the redundant **Notice** label. The message and information icon are vertically centred with the dismiss button, including wrapped text; error labels remain visible. To check, open Personal information and Cancel without editing. Expect **Dialog changes discarded.** at the bottom right, aligned with the cross icon; dismiss it using the cross.

Entry-position follow-up: resume-MFE build and lint passed. Live Chrome keyboard selection verified all three experience footers, a nested achievement, a Project entry, panel resizing, section-heading fallback and Preview hiding. Each selected entry measured a 6px gap and zero horizontal centre error. Fresh pointer-hover and phone checks remain manual; the existing hover delay is unchanged. No saved resume content was modified.

- Affected shared/shell/resume lint and production builds passed. Shared TypeScript check passed. Tests passed **54/54**: shared 12, shell 9 and resume editor 33. The shell regression covers editor/intake, library and unrelated route classification. The existing nonfatal federation `vm` build warning remains.
- Chrome at 1280×538, 900×800 and 390×844 retained the 794×1123 paper. Tablet/phone toolbar measurements placed it 6px below the section and within 0.01px of its centre; the body had no horizontal overflow. Selecting blank sections kept the desktop header at 72px and paper scale unchanged. The pointer transition that previously hid Projects actions now opens its AI dialog correctly.
- Expanded and 72px collapsed sidebar restoration, Edit/Cancel focus, AI Cancel focus, responsive ATS unavailable state, Preview, and unchanged Save state were checked. The saved corrected import retained all **69 checked populated fields**. No existing resume was changed or resaved; one blank account resume was created locally to reproduce the reported issue.
- The final fresh browser tab recorded no warning/error logs. The intermediate tab retained transient Vite HMR errors while shared assets were rebuilt; a full reload loaded the final frontend.
- Backend/DB tests and live AI, ATS, PDF or fresh OAuth consent were not run for this frontend slice. The earlier database persistence evidence remains below. Screenshots remain temporary local verification artifacts, outside the repository.

Commands used for this slice:

```sh
pnpm --filter @resume-forge/shared --filter @resume-forge/shell --filter @resume-forge/resume-mfe lint
pnpm --filter @resume-forge/shared --filter @resume-forge/shell --filter @resume-forge/resume-mfe test
pnpm --filter @resume-forge/shared --filter @resume-forge/shell --filter @resume-forge/resume-mfe build
pnpm --filter @resume-forge/shared typecheck
git diff --check
```

The resume-MFE lint/build/tests were rerun after the pointer change; its final build includes the responsive section-toolbar CSS.

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
