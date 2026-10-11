# UI refinement — 2026-09-29

## Historical evidence notice — 2026-10-11

This document retains the original plan or dated inspection/verification. It is not the current implementation register. Later resume persistence, PDF, readiness/JD scoring, paid Gemini, templates and UI changes supersede earlier pending/synthetic-only/provider/branch claims. Current status and remaining acceptance are in the [implementation audit](implementation-audit.md). Historical browser observations and test counts were not rerun for this documentation audit.

## Slice and rationale

The live request prioritizes inspecting and improving the confusing interface. P1.2 was marked complete, but browser inspection showed unfinished F01 usability: developer controls in the header, creation and editing on one screen, internal IDs in labels, simulated persistence claims, and missing app utility styles. This slice repairs that foundation before P1.3. P1.3 still depends on D03/D04/D08/D11 and a development database; those choices are not inferred from a request for visual improvement.

## Direction

A personal document workspace with a stable sidebar, one page title, one primary action and white resume paper. Base colors: canvas #F7F8FA, surface #FFFFFF, muted surface #EEF1F6, ink #172033, secondary ink #536079, action #4338CA. Dark appearance uses the existing slate surfaces with a lighter primary accent and dark button text. System sans supports the working interface; installed Georgia gives the document illustration and sample page a distinct typographic role. No new remote fonts or images.

Layout: `navigation | library` becomes `navigation | document + section assistant` inside the editor. On mobile, navigation is collapsible and document/assistant views switch explicitly. Creation has its own route. Product content is left-aligned; the sample document is the visual anchor. Performative UI supplies restrained static Aurora, shared prompt inputs and review surfaces. Avoid extra node effects, pipeline panels and decorative badges in normal workflows.

The design review removed the temptation to put counts, ATS scores, a prompt hero and all sample controls above the editor. The resume itself now leads. Diagnostic controls are under Preferences. These are implementation choices under the user's redesign authorization; they do not approve unresolved data policies.

## Implementation

- Rebuilt the shell, library, creation and editor layouts; simplified profile and sign-in previews.
- Kept the existing federated shell and auth/profile/resume package boundaries.
- Explicit shared Tailwind `@source` scans app sources. The shared package's Turbo build inputs include those same app sources to invalidate CSS caches when their classes change. See [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).
- Native radio controls support creation-mode keyboard navigation. Mobile assistant focus moves to the section heading when document controls are hidden.
- Fake OAuth redirects, persisted-save labels, fixed ATS scores and simulated completed tasks are absent from normal preview screens. Real OAuth buttons are disabled with an explanation.
- Sample edits require request, review and Apply. Selection alone does not propose or mutate text; changing the selection discards an unrelated proposal. Applies change only the selected sample section and reset on leaving the editor.
- No master profile, contact, database, AI, storage, PDF or real authentication capability was implemented by this UI slice.

## Design skill

Installed `frontend-design` from [Anthropic's official skills repository](https://github.com/anthropics/skills/tree/main/skills/frontend-design) using the skill-installer helper. The skill lives in the user's Codex skills directory, outside this repository. Its guidance was read and applied; automatic discovery is available on the next turn.

## Verification completed — 2026-09-30

| Check                  | Actual result                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build`           | 7/7 successful; 5 freshly built, 2 cached unchanged packages; 8.617 seconds                                                                                                                                                         |
| `pnpm check`           | 16/16 successful; 10 fresh, 6 cached tasks; 5.267 seconds                                                                                                                                                                           |
| Built frontend servers | Existing `pnpm --parallel --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe preview`; browser loaded hashed `/assets/` scripts, not Vite dev client |
| Production federation  | Shell successfully loaded resume, profile and auth modules; styles consistent                                                                                                                                                       |
| Desktop/tablet/mobile  | Visually reviewed 1280px, 800px and 390px; also measured no document overflow at 320px for library/create; tablet wordmark fixed from 54px wrap to 38px single line                                                                 |
| Creation               | ArrowRight selected the next native radio; blank role showed a useful error; sample role submission showed the preview-only confirmation and opened the editor                                                                      |
| Editor                 | Development-browser review verified explicit request, review and selected-section-only Apply; production mobile selection opened assistant and focused its heading; selection alone showed no proposal                              |
| Profile                | Invalid three-character headline showed an error; Reset restored the fixture; Check preview explicitly reported nothing saved                                                                                                       |
| Appearance             | Light/dark toggle worked; document remained `rgb(255, 255, 255)` in dark appearance; reduced-motion preference toggled; welcome decoration stays static                                                                             |
| Recovery               | Preferences → Developer diagnostics → Simulate remote failure showed a contained error; Try again restored the auth module and shell navigation remained usable                                                                     |
| Console                | No errors/warnings during normal production flows before the deliberate failure; the deliberate failure produced the expected synthetic React error                                                                                 |
| Core color pairs       | Standard sRGB contrast calculation: ink/white 16.27:1; secondary ink/muted surface 5.59:1; white/indigo 7.90:1; dark muted text/surface 5.71:1; dark button text/primary 8.16:1                                                     |

Build warning: the federation plugin references Node's `vm` module and Vite externalizes it for browser compatibility. Build succeeds and the tested client routes work. This warning is retained rather than silently upgrading the stack.

Limits: no real OAuth, database, authorization, AI, scoring or PDF end-to-end checks apply to this UI-only slice. No comprehensive screen-reader/IME suite or mobile CPU benchmark was run. System fonts were used without downloading or redistributing font assets. Sample interactions do not establish backend policy correctness.

## Local verification

1. Run `pnpm install --frozen-lockfile` if dependencies are missing, then `pnpm dev` from the project root. Stop any preview servers using the same ports first.
2. Open `http://localhost:3000`. Expect **My resumes**, a sample document card, and **New resume**.
3. Open **New resume**. Choose a mode with the keyboard; an empty role in tailoring mode should show an error. Submission explains that creation is not connected.
4. Open the sample editor. Select a section, request a sample, and Apply/Discard. Only Apply changes that selected sample section; leaving the editor resets it.
5. On a narrow window, use the menu and document/assistant buttons. Change themes; the resume remains white.
6. Visit **My profile** for validation/reset and **Preferences → Developer diagnostics** for failure/retry.

Screenshots: [desktop library](verification/resume-library-desktop.png) and [mobile creation](verification/resume-create-mobile.png).

Suggested commit message: `feat(ui): refine workspace navigation and resume preview flows`
