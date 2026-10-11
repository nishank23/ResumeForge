# Forge Studio UX/UI design

## Current audit status — 2026-10-11

The bounded Performative UI redesign, full-screen sign-in, device themes, normal library search, AI button contrast and template gallery fixes are implemented. The active branch is fixes. Full accessibility/performance/render release gates remain verification work.

See the [full source-linked audit](implementation-audit.md). Dated checkpoints below remain history.

## Approved direction — 2026-10-10

The user approved implementing Forge Studio on **ux-ui-update** after rejecting the ocean/teal redesign. CareerZenith remains a capability reference. The new identity uses charcoal/violet surfaces, a distinctive ASCII intake spotlight and a quieter document studio. Existing backend/authentication/scoring/save and AI contracts stay intact. This is presentation work on the existing whole-app slice, not a new service or product workflow.

## Sign-in and editing refinements — 2026-10-10

Keep the approved charcoal/violet tokens, Sora display type and DM Sans controls. The sign-in screen becomes a standalone, full-width entry with a large Forge Studio wordmark and a full-screen, interactive AsciiHero field. Header/theme controls and footer messages sit inside the same edge-to-edge scene; no outer border or radius remains. Narrow screens stack the card and use a full-height static field. The Google action remains the clear entry point. Authenticated visitors go straight to their server-derived resume library; account sign-out moves to Preferences. The library uses a quiet search action, while the selected-entry Improve with AI action receives Performative UI's glow and sparkle. Remove the read-only A4/Fit-to-width strip and tinted outer paper surround; retain automatic fit-to-width scaling, overflow guidance and actual document margins. Use one short route fade in response to navigation, disabled by reduced motion.

```text
Signed out: full-screen ASCII / Resume workspace + theme toggle
            Forge Studio + story | Google sign-in
            Both footer messages inside the same scene
Signed in: sidebar | My resumes / quiet search / saved list
Editor:              clean white paper / selected-entry glowing AI action
```

The memorable entry is specific to Forge's document studio: large brand type over a text-generated field, rather than another generic workspace welcome card. Utility controls and printable content stay quiet. This applies the user's five requested refinements without adding new product actions or changing provider/session policies.

## Tokens and typography

| Role           | Dark                   | Light                  |
| -------------- | ---------------------- | ---------------------- |
| Canvas         | Carbon #111014         | Canvas #F5F3F8         |
| Surface        | Glass #1B1921          | Paper #FFFFFF          |
| Raised surface | #292531                | #EEE8F7                |
| Primary text   | Ink #F8F6FD            | Ink #271F35            |
| Secondary text | #B8B1C6                | #6B607C                |
| Accent         | Violet #B89AFF         | Violet #6631C2         |
| Primary button | #8252DE, hover #6635BE | #7439CB, hover #5B2CAA |
| Border         | #393341                | #DED7E8                |

Sora carries short headings and the wordmark; DM Sans carries interface text. Google Fonts uses display=swap and sans fallbacks. The resume retains its stored font choices and opaque white paper; no UI typeface, backdrop, score or animation enters JSON/PDF output. Secondary text contrast is 7.23:1 on the dark raised surface and 4.88:1 on the light raised surface. White primary-button text is 4.99:1 dark / 6.58:1 light. These calculated pairs are a focused check, not a complete accessibility audit.

## Layout

```text
Library: workspace sidebar | My resumes
                           | Full-width ASCII spotlight: Upload / Create
                           | Saved resumes: search / sort / rows / icon actions

Editor: All resumes / Forge Studio / actual title / saved state / actions
        Content / Template / Review       Editor / Preview / Focus
        White resume paper                Compact inspector
                                          ATS readiness | Tailor to job
                                          Score / first priority / disclosures

AI review: selected entry / validated result notice / inline del-ins
           full original-suggested disclosure / Cancel / Apply and save
```

Headings, controls and review copy align left; the resume follows its own formatting contract. The inspector moves below the paper on narrow screens. Focus hides it, and Show tools restores it. The global workspace sidebar hides during editing and returns through All resumes. Duplicate JD navigation becomes one Tailor to job view. First pending priority opens, secondary groups collapse, and every check keeps its exact target/status. Fit to width remains the canvas default.

## Performative UI placement and compatibility

Installed **performative-ui 0.7.0** stays pinned. Installed source/types and the earlier official catalog inspection informed these adapters; no package was upgraded.

| Component                     | Actual placement                                    | Guard                                                                                                     |
| ----------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| AsciiHero                     | Full-screen sign-in and full-width library intake | Decorative; static fallback on mobile/touch/reduced motion; unmount hidden/offscreen                      |
| PromptHero                    | Saved-library search                                | Real search/focus action, named native field, Enter submit                                                |
| Prompt                        | Existing JD composer                                | Hidden voice/model/context controls; native text limits, busy/short-JD/unsaved guards and explicit submit |
| Temperature                   | ATS/JD score track                                  | Inert, aria-hidden inner widget; real outer semantic meter; unavailable score displays a dash             |
| NodeGraphBackground           | Small inspector heading         | Violet, contained, slow, static quiet/mobile fallback; separate from paper                                |
| ChatBubble / TokenStream      | Validated AI result notice                          | Full screen-reader text; static reduced motion; no pretend server streaming                               |
| Button / GlassCard            | Existing primary actions and intake surfaces        | Shared native semantics, focus and disabled state                                                         |
| StatusDot / WibblingSpinner   | Actual saved and pending states                     | Accompany named state; requests drive feedback                                                            |
| BeforeAfter / evidence bubble | Existing full-text review and returned JD evidence  | Semantic inline del/ins and explicit Apply remain authoritative                                           |

Shared shadcn-based Dialog, native details disclosures and Tiptap retain accessibility/editing behavior. The installed takeover Popover lacks suitable focus handling for these dialogs and was not substituted. No inert custom rewrite prompt was added: the server currently accepts a selected target, not freeform instructions. Components serve supported actions instead of creating new workflows to increase their count.

## Review and acceptance

The ASCII spotlight is the memorable library element. Surrounding navigation and inspector surfaces stay quiet so paper and actionable feedback remain primary. The visual structure differs from the reference product through one horizontal tool row, paper-left/right-inspector layout, two themes, typography, ASCII intake and compact disclosures. Screenshot review found and fixed a 5px overflow at 320px; both 320px and 390px now fit.

Verify affected builds/typecheck/lint, existing frontend tests, real route navigation, synthetic save/reopen, scoped AI review/Apply, local JD submission, dialog labels/focus, reduced motion and responsive widths. Do not claim completed OAuth/import/export or broad ATS/model quality from styling checks. [Actual evidence and limits](ux-ui-update-verification.md). Source changes remain uncommitted on ux-ui-update.
