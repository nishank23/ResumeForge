# Forge Studio verification — 2026-10-10

## JD composer focus and action — 2026-10-11

**Gemini sparkle follow-up:** JD analysis now uses the exact Performative `Sparkle` (`✦`) rendered by the shared Button for **Improve with AI**. The optional `sparkle` prop defaults to the existing `glow` behavior, so current rewrite buttons retain their appearance; StudioPrompt requests the icon separately without adding glow. Shared icon styling keeps it white, leading the label, decorative (`aria-hidden`) and non-animated in both themes. Local rules has zero sparkles; Gemini has exactly one. Shared declaration/production build, affected lint/TypeScript and whitespace checks pass. Live browser checks cover both themes and requested 320/390 widths; the button has no horizontal overflow. Screenshots: `/private/tmp/forge-gemini-performative-{light,dark}.jpg`. Dark appearance and viewport were restored. JD text was not edited; no AI request or resume save was performed.

The installed Performative UI 0.7 Prompt renders `pui-promptbox`, not the earlier adapter's `pui-prompt` selector. Its glow combined with form and textarea focus outlines, while resume-MFE rules added another textarea border. The shared adapter now gives the writing field one outer focus border, a transparent unbordered textarea and a compact divided action footer. A labeled native submit button replaces the disconnected label and icon-only Send control. The existing capture guard, controlled value, 12,000-character bound, busy/disabled state and Cmd/Ctrl+Enter behavior remain.

Design retains the approved Forge palette: Carbon #111014, Glass #1B1921, Ink #F8F6FD and Violet #B89AFF in dark mode; Paper #FFFFFF and Violet #6631C2 in light mode. DM Sans remains the left-aligned form font. The writing surface stays quiet; violet identifies focus and the real analysis action. Library search uses the unchanged single-line branch. No provider, scoring, persistence or resume-paper changes.

Actual checks passed:

- `pnpm --filter @resume-forge/shared build`, `lint` and `typecheck`.
- `pnpm --filter @resume-forge/resume-mfe build`, `lint` and `typecheck`.
- `pnpm --filter @resume-forge/resume-mfe test`: **50/50** existing regression tests.
- `git diff --check`.

Live in-app browser verification used the existing signed-in session. Requested viewport sizes were 1440×960, 390×844 and 320×740; the browser's existing zoom yielded effective CSS widths of 1309, 354 and 291. Both themes show a borderless textarea with no separate outline and one form focus shadow. At both narrow widths, composer scrollWidth equals clientWidth and document width equals viewport width. Tab reaches the labeled action with a visible outline. Only one method is pressed. Empty and 49-character input disable submission; Ctrl+Enter with short text starts no analysis. Valid input enables the matching action; plain Enter adds a newline. A 2,370-character synthetic JD scrolls inside the bounded field. The submit button has no continuous animation.

Screenshots contain synthetic JD text: `/private/tmp/forge-jd-composer-dark.jpg` and `/private/tmp/forge-jd-composer-light.jpg`. Test text was replaced with the original saved JD; dark appearance and the temporary viewport were restored. No AI request or resume save was triggered. Live provider submission, Apply and PDF export were not repeated for this presentation fix.

Manual check: open a saved resume, choose **Review → Tailor to job**, and expand the JD editor. Paste a JD, check that only one border highlights while typing, switch analysis methods, and Tab to the labeled action. Try light and dark modes and a narrow window. Existing saved-version and analysis rules still apply.

## Historical evidence notice — 2026-10-11

This document retains the original plan or dated inspection/verification. It is not the current implementation register. Later resume persistence, PDF, readiness/JD scoring, paid Gemini, templates and UI changes supersede earlier pending/synthetic-only/provider/branch claims. Current status and remaining acceptance are in the [implementation audit](implementation-audit.md). Historical browser observations and test counts were not rerun for this documentation audit.

## Full-screen ASCII sign-in

Latest signed-out entry is edge to edge: no outer hero border, radius or padding. Header/theme control, branding, Google card and both footer messages are children of the same ASCII scene. Desktop uses two columns; <=980px stacks content; short/narrow displays allow normal vertical scrolling. The optional full-screen static fallback belongs only to auth, without enlarging the library field or changing existing canvas activity guards.

Actual commands passed:

- `pnpm --filter @resume-forge/shell test`: 15 passes.
- `pnpm --filter @resume-forge/shared build`: declaration/production build passes.
- `pnpm --filter @resume-forge/shared --filter @resume-forge/shell --filter @resume-forge/auth-mfe -r lint`: all pass.
- `pnpm --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe -r build`: all four TypeScript/production builds pass.
- `git diff --check`: passes.

Chrome dark-mode hero measures x=0, y=0, width=1440, height=638 at a 1440×638 viewport, with 0px border/radius. Header/footer are inside auth. At 320px and 390px, document width equals viewport width; 900px tablet stacks the card. Final 390×844 view uses a full-height static ASCII field, 97 lines and zero canvas. Temporary viewport settings were reset. Screenshots: `/private/tmp/forge-fullscreen-ascii-dark.png` and `/private/tmp/forge-fullscreen-ascii-mobile.png`.

The existing palette, Google/session/recovery handlers, shell theme callback and authenticated library handoff are preserved in source. This slice does not add provider/backend/save/AI/PDF proof; live light-theme preview and OAuth were not repeated. Existing earlier evidence below retains its dated limits. No credentials, resume data or OS appearance were changed. [Manual steps](archive/readme-history.md#full-screen-ascii-sign-in--2026-10-10).

## Device theme default

The shell passes **15 tests**, including five new theme cases, plus its production build/TypeScript check, lint and `git diff --check`. Logs: `/private/tmp/forge-device-theme-{tests,lint,build}.log`. Tests cover initial device appearance, live media changes, stable manual overrides, reset, reload persistence, invalid/blocked storage and subscription cleanup/remount.

Chrome reports `prefers-color-scheme: dark = true` and first-visit device mode renders a dark root. Preferences → Light immediately changes the root to light and retains the selected mode after reload. The header toggle selects/persists Dark. Choosing Use device theme returns to system mode, dark on this device, and survives reload. Screenshot: `/private/tmp/forge-device-theme.png`; no OS setting or resume data was changed. Actual OS appearance changes and standalone remote entrypoints were not exercised; media-change behavior has unit evidence. Existing backend/AI/document behavior was not retested for this shell-only refinement. [Manual steps](archive/readme-history.md#device-theme-default--2026-10-10).

## Upload, AI action and template refinements

Current slice on **ux-ui-update** passes **80 tests** (shared 13, shell 10, profile 7, resume MFE 50), shared/all four frontend builds, five-package lint/typecheck and `git diff --check`. New pure template tests cover three distinct appearances, strict save-envelope round trip, fact preservation, cloned defaults, unknown/custom identification and local history. Final logs are `/private/tmp/forge-upload-template-final-{tests,typecheck,lint,build}.log`; shared build is `/private/tmp/forge-upload-template-final-shared.log`.

Actual Chrome verification:

- Upload opens a root modal over the library without changing its URL. Empty TXT returns a recoverable non-empty/10 MB validation error; valid synthetic TXT opens editable extracted-field review in the same dialog. Inner project Edit/Escape keeps review open; close opens Discard confirmation and Keep reviewing restores it. Confirm and save creates one new owned synthetic resume at version 1 and opens its saved editor. Existing real resumes were not changed.
- Shared root portals place the template gallery above the document; DOM center hit-testing returns its card, and portal parent is BODY. Topmost Escape, Tab wrap, review-step focus and close-to-upload-button restoration pass. Body overflow returns to its previous empty value after closing.
- Modern applies Arial and indigo section headings without losing project text; Undo restores Classic. Editorial save on Forge UI QA produces version 6; reload retains Times body and 44px side margins. A one-page PDF downloaded through Chrome's native Save dialog is 68,871 bytes; PDF.js confirms retained project title and description. Its synthetic file is `/private/tmp/Forge_UI_QA__Synthetic_-v6.pdf`.
- Floating AI, manual Edit assistance and AI request dialog all show a Performative sparkle. Light-mode computed icon/text are white with no transparent gradient; dark presentation is also checked. Opening/canceling remains non-submitting and non-mutating. New provider generation/Apply was not rerun for an icon/layer change.
- Gallery and upload dialogs fit 320px/390px. At 320px gallery/client scroll widths both equal 286px; its inner body is 238px without overflow. A clipped selection label was fixed with wrapping; text scroll/client widths both equal 82px. Done stays visible while mobile cards scroll. Temporary viewport overrides were reset.

Desktop screenshots: `/private/tmp/forge-template-gallery-final-dark.png`, `/private/tmp/forge-template-gallery-final-light.png`, `/private/tmp/forge-upload-modal-light.png`. Screenshots and synthetic files remain outside Git. Chrome's extension lacked file-URL access; native picker tests succeeded without enabling broader permissions. PDF automation timed out because a native Save dialog awaited confirmation; completing that dialog produced the verified artifact.

Templates are three single-column formatting styles, not new layouts or an independent MFE. APIs/parser/PDF renderer, immutable versions, provider grounding and contacts policy are reused. This slice does not prove all file-format/layout cases, broad screen-reader accessibility, every template's long-resume PDF pagination or new Gemini quality. Full F19/F20 acceptance remains partial. [Manual steps](archive/readme-history.md#upload-dialog-ai-actions-and-template-gallery--2026-10-10).

## Latest entry and editor refinement evidence

The five follow-up changes are implemented on ux-ui-update: standalone ASCII sign-in without workspace sidebar, direct verified-session library entry, normal search, selected-entry AI glow/sparkle, and removal of A4/Fit-to-width labels with a neutral canvas. Preferences now exposes sign-out; existing server-session revocation and retry remain. Pending sign-in verification and initial editor loading avoid welcome/error flashes. One 220ms navigation fade respects reduced motion.

Fresh final checks pass **78 tests** (shared 13, shell 10, profile 7, resume-MFE 48), shared/four frontend builds, five-package typecheck/lint and whitespace validation, using the commands below. Shared output is **101.07 kB CSS / 20.23 kB gzip** and **251.43 kB JS / 49.64 kB gzip**. New route coverage checks authenticated entry without URL-flag authority and prevents welcome mounting before verification. No backend suite was rerun.

Chrome verification used the existing account and synthetic Forge UI QA resume:

- Preferences sign-out succeeds and removes the sidebar. Sign-in has large Forge Studio branding and an active AsciiHero on desktop; 320px uses static fallback, with equal page/viewport width.
- Existing-account Google sign-in opens My resumes directly. An authenticated `/sign-in` visit also returns to the library; its saved documents and sidebar remain available.
- Quiet Search and Enter filter the list and focus Saved resumes. Search has a solid button and no glow/sparkle.
- The project toolbar's center matches its entry exactly and begins 6px below its bottom. The actual PUI glow/sparkle action opens the same selected-project AI dialog. Cancel preserves version 5. At 320px the toolbar wraps inside a 272px box and the document scroll width stays 320px.
- Light and dark editor views omit the removed metadata. At 390px the 794px paper scales to 366px, matching its viewport; light outer canvas is neutral rgb(241,241,243). Stored document geometry remains unchanged.
- Preferences reduced motion produces `animation-name: none` on the route and static ASCII. Temporary viewport and motion overrides were reset.

Evidence screenshots are local temporary files: `/private/tmp/forge-refined-sign-in.png`, `/private/tmp/forge-refined-sign-in-light.png`, `/private/tmp/forge-refined-library.png` and `/private/tmp/forge-refined-editor.png`. No real resume text or credentials were added to Git. Source remains uncommitted. New provider generation/Apply, browser import and completed downloaded PDF contents were not repeated for this refinement. The earlier design-pass evidence below retains its original limits.

## Delivered scope

Implemented the approved charcoal/violet Studio design locally on **ux-ui-update**, preserving the earlier dirty whole-app frontend work. Shared tokens cover shell/account/profile/preferences/library/import/editor/review. Sora and DM Sans style the UI; saved resume fonts, white paper and PDF rendering remain independent. Full-width AsciiHero intake sits above the library. The paper-left/right-inspector editor uses Content/Template/Review, Editor/Preview and Focus. Review contains ATS readiness and Tailor to job only. Secondary feedback collapses without losing per-entry actions/status. Temperature displays the real score; PromptHero searches saved resumes; Prompt submits the existing JD request. NodeGraph stays in small app surfaces. ChatBubble/TokenStream reveals a validated result notice after response arrival. Native Dialog, disclosures, Tiptap, inline del/ins and reviewed Apply remain.

No service, credential, permission, schema, dependency, provider, score-weight or resume-content contract change is included. No backend/database suite was rerun for this frontend slice. Existing functionality is covered by the evidence below; styling checks do not guarantee every possible workflow.

## Automated checks

Commands run in `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2`:

```sh
pnpm --filter @resume-forge/shared build
pnpm --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe -r build
pnpm --filter @resume-forge/shared --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe -r typecheck
pnpm --filter @resume-forge/shared --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe -r lint
pnpm --filter @resume-forge/shared --filter @resume-forge/shell --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe -r test
git diff --check
```

**77 tests, zero failures:** shared 13, shell 9, profile 7, resume-MFE 48. Baseline and post-change suites pass. Shared and all four frontend builds, five-package typecheck/lint and whitespace checks pass. Shared emits about **97.86 kB CSS / 19.71 kB gzip**, **250.81 kB JS / 49.46 kB gzip**. These are build sizes, not rendering-performance measurements. Federation emits the existing Node-vm browser-externalization warning. Vite initially retained old shared export metadata; a frontend refresh resolved the missing-export runtime error. The shared launcher also stopped services during that refresh, and they were restored with the existing private local configuration. No credentials/grants/data were changed.

## Browser evidence

Chrome used the existing authenticated personal stack at localhost:3000. Screenshots contain synthetic resume content. Existing real resumes were not edited by this agent.

- **Library:** full-width intake, named search and sort remain. PromptHero Enter focuses Saved resumes after filtering Forge UI QA. The named Delete dialog identifies version 5 and focuses Cancel; Cancel preserves the row and returns focus to its delete icon. Prior whole-app verification covered confirm/Undo; that mutation was not repeated for this refinement.
- **Authentication:** the browser returned to the signed-out screen during final verification. Continue with Google completed the normal existing-account OAuth flow and displayed the signed-in account with Open my resumes. No credential or permission changes were made; sign-out was not exercised.
- **Navigation:** opening a resume hides the workspace sidebar; All resumes restores it. Content opens real section controls; Template opens existing formatting controls. Focus hides the inspector and restores through Show tools. Preview removes inline editing/actions and disables content mutations; Editor restores them.
- **Persistence:** Forge UI QA (Synthetic) started at version 3. A manual project-description edit stored version 4. Reviewed Gemini Apply stored exactly version 5. Reopening after a browser reconnection retained version 5 and the chosen app/application replacement. No unrelated resume was changed by this agent.
- **AI:** existing version 3 returned No changes needed. Version 4 returned a validated selected-project replacement with one red del and one green ins, original text between changes, full-text disclosure and explicit Apply. Cancel/Done retain content. Fact/model/version guards are unchanged; variable provider success is not guaranteed by this UI change.
- **JD:** short text remains editable with Analyze disabled. The same Prompt field accepted a synthetic backend JD; explicit Local rules submission returned **80/100 for saved version 3** and collapsed the composer. Later version changes correctly stale that evidence. No new Gemini-JD quality/calibration claim is made.
- **Responsive:** editor page scroll width equals the viewport at **320px and 390px**. A 5px tool-tab overflow at 320px was fixed and rechecked. Library fits 390px. At 390px the AI dialog is **356px client / 356px scroll width**, with real del/ins. Temporary viewport overrides were reset.
- **Themes/motion:** both light/dark surfaces render while paper stays white. Reduced motion sets the application flag true, the library reports static-fallback and has zero canvas elements. Its preference was restored after testing. Mobile also uses static ASCII and zero canvas. OS reduced-motion/offscreen/tab handling is implemented in the existing shared hooks; no OS setting or broad performance benchmark was changed/run.
- **Contrast/accessibility:** secondary text is 4.88:1 light / 7.23:1 dark on raised surfaces; white action text is 6.58:1 light / 4.99:1 dark. Score meters are read-only; unknown scores use an image description rather than fake zero. Dialog initial focus, delete Cancel return and named icon controls were checked. This is not a full keyboard/screen-reader audit.

## Boundaries and manual checks

Sign-out, a newly uploaded browser file and completed PDF file contents were not reverified. Normal Google sign-in recovery was verified. The earlier UI pass showed saved-version PDF download-start feedback, but the extension returned no downloaded artifact. The earlier upload attempt was blocked by the extension's Allow access to file URLs permission; its current permission state was not changed. No security bypass is used. Broad accessibility, long-resume performance, deployment and full F07/F19/F20 acceptance remain separate work.

Use the [README checklist](archive/readme-history.md#check-forge-studio) to test your own resume: save/reload, Content/Template/Review, ATS Fix target, Tailor to job, one scoped AI review, Cancel/Apply, theme and reduced motion. Local screenshots `/private/tmp/forge-studio-library.png`, `/private/tmp/forge-studio-editor.png` and `/private/tmp/forge-studio-ai-review.png` are review artifacts outside Git. No real contact fixture, secret or runtime/generated build file is added.
