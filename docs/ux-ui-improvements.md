# Resume workspace UX improvements

## Approved scope

On 2026-10-20 the user approved the reviewed design and requested branch `ux-ui-improvment`, existing Performative UI adapters and compatibility with the Studio design system. Changes cover resume creation/import review, editing, feedback, direct job tailoring and saved PDF handoff. Backend authorization, AI models, factual validation, scoring, storage and deployment configuration remain unchanged.

## Design plan

The document is the main object. Existing professional facts, original/suggested wording and a separate tailored copy carry the experience; decorative effects do not carry workflow meaning.

Use the existing token roles: Carbon `#111014`, panel `#1b1921`, ink `#f8f6fd`, violet `#b89aff` and border `#393341`. Light mode keeps Mist `#f5f3f8` and its existing ink/accent roles. Sora remains the heading face, DM Sans remains the UI body face, and printable resume fonts remain separate. All new CSS reads shared tokens rather than introducing a new palette.

Focused builder revision (2026-10-21): the user found the permanent section list and feedback controls overwhelming. Writing now opens with the document alone. A single task bar offers **Write**, **Improve** and **Design**; tailoring remains a direct, explicit action in the header.

```text
Resume title + saved status                       More | Tailor | Download
Write | Improve | Design                                           Preview
                         Editable document       Optional selected tool
```

There is no permanent left sidebar and no initial feedback panel. More contains Manage sections and title/contact editing. Preview shares the task toolbar rather than a separate document-control row. Improve and Design replace that panel, so only one tool is visible. Write and the panel close button restore the document. The title shows a concise Saved or Unsaved changes status. Version details remain available through saved-document behavior rather than repeated workspace labels. Preview is a single toggle with Back to writing.

Phone/tablet uses the same task bar and one surface at a time. Compact editing reflows at readable sizes; Preview retains exact A4 typography. Returning from a scoped feedback editor keeps the user with their suggested fixes. Section/entry IDs, unsaved edits, saved appearance and PDF content survive task switching. Selected-content actions remain outside printable paper. The user's 2026-10-22 correction restores the original delayed hover behavior, along with click/keyboard selection, so Improve with AI is available directly on the selected summary or experience/project description. Edit details and Improve with AI are primary; move/hide/delete are in a labeled More menu. Delete still requires confirmation and Undo remains available.

### Reference research

Reviewed public product pages and official help documentation, not signed-in competitor sessions:

- [LoopCV CV Builder](https://www.loopcv.pro/ai-cv-builder/) separates choosing a template, writing content, reviewing and downloading. Its advertised flow supports choosing a task before exposing its settings; it does not prove the usability of its authenticated editor.
- [Teal Resume Designer](https://help.tealhq.com/en/articles/9508951-getting-started-resume-designer) places formatting in a separate Designer tab. We keep appearance settings out of the initial writing view.
- [Resume.io preview](https://help.resume.io/en/articles/3785216) keeps a live document preview available and provides a way back to editing. Our existing exact-layout Preview and desktop document/tool split retain this context.

These are interaction references, not copied visuals or evidence of increased completion. The existing Studio theme and components remain. The deliberate change is information hierarchy: one resume, one current task, one suggested fix.

This is an app workspace, which design-taste-frontend explicitly excludes from its marketing-page workflow. The implementation uses its screenshot/readability critique and frontend-design's subject-led hierarchy. No marketing direction draw, photograph floor, decorative-motion quota or gallery score is claimed. Existing Studio colors and component conventions take priority.

## Connected behavior

- The library keeps Upload resume and Start from scratch. Each saved resume has a direct Tailor for a job action. Text actions use their content width; only download/delete icon controls use fixed square sizing. Its `?action=tailor` link opens the existing editor directly into tailoring; the query grants no resource access.
- Import review occupies the page rather than nesting a full editor inside a modal. The import stays unsaved until Confirm import. Existing discard confirmation, editable fields and optional extracted-text reference remain. Upload copy correctly says server processing and no AI-provider transmission during import.
- Resume score replaces detailed general-readiness check lists, including priority cards, All checks and category breakdowns. The existing returned score, loading/error/retry, stale-version warning, manual recheck and unsaved-preview guard remain. It is labeled an internal content score. Job fit remains the existing separate job-description comparison; its scoring and evidence flow are unchanged.
- Hovering reveals the existing Improve with AI action after the original 150ms delay. Moving to its toolbar cancels pending hover changes. Opening it retains the scoped original-text/review dialog; AI submission still requires the dialog action. Header/contact fields never become AI rewrite targets.
- Save & download saves first, then exports the returned immutable version, using the saved snapshot title for its filename. Save & tailor waits for the owner to refresh callbacks for that returned revision. Save failure/conflict stops the follow-up. Edits made while saving remain dirty and prevent an older snapshot from entering a new tailoring request. No autosave-on-keystroke or silent AI submission was introduced.

## Three tailoring phases

**Job description:** paste a JD. The prompt is the first task, without another repeated heading or instructions. Optional experience questions appear collapsed only after a usable JD (at least 50 trimmed characters); AI scope remains available under What is sent to AI?. Opening them with a valid JD uses local preflight to retain relevant question selection; the result is reused when starting. Added facts stay tied to the original visible entry and need a separate inline confirmation checkbox. Editing facts or the JD clears that confirmation. The primary Tailor my resume action has one fixed footer location. The full Gemini processing scope is available under What is sent to AI?. A saved-facts-only request has no empty confirmation page.

**Review changes:** real queued/writing/fact-review status appears until the stored proposals are ready. Users review one suggestion at a time with Previous/Next or the shared suggestion selector. Suggested wording appears first. Compare with original opens complete original/suggested text, factual explanation and supporting evidence together. Each accepted/rejected choice persists while navigating. Copy name and job-fit details is a single collapsed disclosure after the changes; naming is optional and still reaches Apply. Material warnings and stale/expiry/error messages stay visible. Users inspect the selected result beside the review. Desktop input and review keep the resume beside the controls; each pane scrolls independently beneath compact phase navigation and above persistent footer actions. Narrow screens can switch between controls and Preview during job input as well as review. Detailed job-fit scores, required evidence and quality metadata remain available without dominating the review. Unsupported requirements remain gaps.

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
