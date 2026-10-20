# Resume workspace UX improvements

## Approved scope

On 2026-10-20 the user approved the reviewed design and requested branch `ux-ui-improvment`, existing Performative UI adapters and compatibility with the Studio design system. Changes cover resume creation/import review, editing, feedback, direct job tailoring and saved PDF handoff. Backend authorization, AI models, factual validation, scoring, storage and deployment configuration remain unchanged.

## Design plan

The document is the main object. Existing professional facts, original/suggested wording and a separate tailored copy carry the experience; decorative effects do not carry workflow meaning.

Use the existing token roles: Carbon `#111014`, panel `#1b1921`, ink `#f8f6fd`, violet `#b89aff` and border `#393341`. Light mode keeps Mist `#f5f3f8` and its existing ink/accent roles. Sora remains the heading face, DM Sans remains the UI body face, and printable resume fonts remain separate. All new CSS reads shared tokens rather than introducing a new palette.

Desktop composition:

```text
Resume title                         Edit actions | Tailor | Download
Sections                 Resume / selected actions          Feedback
Personal details         Editable document                  Priority fixes
Experience               Exact layout in Preview            All checks
```

Phone/tablet composition uses one current surface: Resume or Feedback/tools. Compact editing reflows at readable sizes; Preview retains exact A4 typography. Section/entry IDs, saved appearance and PDF content do not change when switching views. Selected-content actions sit outside printable paper and appear after a target is selected.

This is an app workspace, which design-taste-frontend explicitly excludes from its marketing-page workflow. The implementation uses its screenshot/readability critique and frontend-design's subject-led hierarchy. No marketing direction draw, photograph floor, decorative-motion quota or gallery score is claimed. Existing Studio colors and component conventions take priority.

## Connected behavior

- The library keeps Upload resume and Start from scratch. Each saved resume has a direct Tailor for a job action. Text actions use their content width; only download/delete icon controls use fixed square sizing. Its `?action=tailor` link opens the existing editor directly into tailoring; the query grants no resource access.
- Import review occupies the page rather than nesting a full editor inside a modal. The import stays unsaved until Confirm import. Existing discard confirmation, editable fields and optional extracted-text reference remain. Upload copy correctly says server processing and no AI-provider transmission during import.
- Feedback leads with up to three existing pending checks, prioritizing existing scored component weights and distinct rule families. It does not change the rubric or promise a score gain. Complete checks, original reasons, per-entry targets, dismissal and restore remain under All checks. Score details are secondary and explicitly separate internal checks from employer ATS results.
- A recommendation opens its scoped editor. Missing experience/skills can open the appropriate section/entry editor directly instead of making the user find it in section controls.
- Save & download saves first, then exports the returned immutable version, using the saved snapshot title for its filename. Save & tailor waits for the owner to refresh callbacks for that returned revision. Save failure/conflict stops the follow-up. Edits made while saving remain dirty and prevent an older snapshot from entering a new tailoring request. No autosave-on-keystroke or silent AI submission was introduced.

## Three tailoring phases

**Job description:** paste a JD. Optional experience questions are collapsed. Opening them with a valid JD uses local preflight to retain relevant question selection; the result is reused when starting. Added facts stay tied to the original visible entry and need a separate inline confirmation checkbox. Editing facts or the JD clears that confirmation. The primary Tailor my resume action has one fixed footer location. The full Gemini processing scope is available under What is sent to AI?. A saved-facts-only request has no empty confirmation page.

**Review changes:** real queued/writing/fact-review status appears until the stored proposals are ready. Users review one suggestion at a time with Previous/Next or the shared suggestion selector. Full original/suggested text stays visible, and each accepted/rejected choice persists while navigating. Users name the copy and inspect the selected result. Desktop input and review keep the resume beside the controls; each pane scrolls independently beneath compact phase navigation and above persistent footer actions. Narrow screens can switch between controls and Preview during job input as well as review. Detailed job-fit scores, required evidence and quality metadata remain available without dominating the review. Unsupported requirements remain gaps.

**Saved copy:** Save copy & download PDF first uses the existing idempotent Apply, then downloads that returned saved copy/version. A failed PDF request leaves the copy saved. Retry only exports; it does not rerun AI or Apply. A reopened saved run can load the owned copy metadata and export it. Closing queued work allows later resumption; cancellation, stale versions, expired proposals and errors remain explicit.

## Shared components

The implementation reuses `@resume-forge/shared` Button (Performative Button), StudioPrompt (Performative Prompt), TextComparison (Performative BeforeAfter), RequestFeedback, DocumentStatus, Checkbox/Input, Dialog, DropdownMenu and existing editor controls. `StudioPrompt.hideSubmit` allows a single visible primary action in the dialog footer; native submit guards remain. No component library or dependency version was added/upgraded.

## Verification

Results are recorded in the current progress tracker. Browser checks render actual source components with synthetic API fixtures, not production accounts or paid-provider calls. They verify UI coordination and error paths; they do not prove live provider quality, real database authorization or real PDF rendering. Existing API/domain/integration suites retain those responsibilities.

Repeat the browser checks with the helper supplied by the invoked design skill:

```sh
pnpm --filter @resume-forge/resume-mfe test:ui --browser-helper /absolute/path/to/design-taste-frontend/scripts/lib/cdp.mjs
```

Node 22+, installed Chrome/Edge/Chromium and project dependencies are required. The fixture server binds loopback, denies private environment/runtime paths and makes no provider calls. Test sources are outside application entrypoints and are not included in the production frontend bundle. Screenshots and value-free results stay ignored under `.local/ux-ui-improvment`.

For manual component review:

```sh
node apps/resume-mfe/test/ui/serve.mjs --serve-only
```

Open its printed `/__resume-ux` URL. Synthetic accounts and API responses are clearly labeled. Use `?view=tailoring`, `?view=import`, `?view=library` or `?theme=light` for focused checks. This fixture does not save real records or download real PDFs.

Before a live release, verify the signed-in source/copy/PDF journey against the deployed API. No adoption or conversion increase is claimed without observing first-time users and measuring actual completion.
