# Frontend Integration and Reference Review

**Updated:** 2026-09-29. **Planning only; development remains unauthorized.** The user requested Performative UI, contextual prompts for selected resume content, and resume-building/tailoring capabilities informed by CareerZenith. Visual concept work is paused; no Studio/Focus layout, palette, or theme is approved.

## Reference evidence and limits

| Reference | Observed on 2026-09-29 | Use in this project |
|---|---|---|
| [Performative UI](https://performative-ui.vercel.app/) | React component catalog; inspected PromptHero and Prompt examples and props in the browser | Selected frontend dependency, adapted through shared wrappers |
| [PromptHero](https://performative-ui.vercel.app/#/components/prompt-hero) | Single-line prompt with controlled value, change/submit callbacks, placeholder and CTA options | Prominent resume creation/tailoring entry point; an explicit action opens the relevant flow |
| [Prompt](https://performative-ui.vercel.app/#/components/prompt) | Multiline input, submit callback, shortcut and optional toolbar controls | Section-specific editing composer; hide voice, model picker, and generic attachments initially |
| [Upstream manifest](https://github.com/vorpus/performativeUI/blob/main/package.json) and [repository](https://github.com/vorpus/performativeUI) | Observed main manifest reports 0.7.0, MIT, React/React DOM 18 or 19 peer ranges and a styles.css export | Compatibility signal only; verify registry release, license files, production builds, styling and accessibility before pinning |
| [CareerZenith dashboard](https://careerzenith.ai/dashboard) | Public review initially stopped at sign-in; follow-up used the user's authorized signed-in Chrome session | Dashboard and editor controls inspected; detailed observations below |
| [CareerZenith public product page](https://careerzenith.ai/) | Advertises resume creation, JD-based changes, section-level assistance, feedback and file intake | Capability inspiration, not proof of implementation quality, ATS accuracy or hiring outcomes |

The initial public review created no account, upload or AI request. In the signed-in follow-up, opening Improve with AI immediately triggered one suggestion against an existing resume section. It completed before Stop could be used; the suggestion was canceled and the section editor closed without Accept or Save. The original wording remained visible. On returning to the dashboard, the reviewed copy's update date had changed; therefore this was not a metadata-neutral inspection. No new resume/JD text was entered or uploaded, and no export, restore or template change was performed. Provider processing and credit usage were not verified. No personal resume contents, private identifiers or account details are copied into this documentation. No competitor code, branding or page copy is imported; its job board, community, pricing and hiring-result labels remain outside our requirements.

### Signed-in editing observations

| Inspected surface | Direct observation | resume-forge treatment |
|---|---|---|
| Editor workspace | Section list beside a document preview; editor/preview modes and export controls | Keep explicit section navigation and preview; final layout remains D06 |
| Section editor | Summary editor with rich-text controls and separate Cancel/Save | Preserve constrained Tiptap editing and explicit persistence |
| AI suggestion | Improve with AI immediately starts generation; a result shows inline changes and Cancel/Accept | Our selection only opens the composer; explicit submit generates a reviewable change, then Apply commits one version |
| ATS feedback | Issue cards, reasons, action controls and pending/completed/deleted groupings | Show actionable evidence and clear status; retain our own five-component rubric and truthful labels |
| Saved JD analysis | JD optimization detail with keyword, description and history controls; restore was offered | Reuse explicit JD context, version history and conflict-checked restoration; no restore was executed |
| Template area | Template/layout, spacing and typography control groups | Reference only; additional template packs and a full customization suite are not added by inspection |

This verifies visible controls and the generated-suggestion/cancel interaction, not backend algorithms, successful save/restore/export, complete editor behavior or mobile/accessibility quality. The prior authenticated-access limitation is resolved; untested actions remain unverified.

## Confirmed direction versus proposed detail

The dependency selection, section-context prompting and broader background/component use come from the user's live requests (U01–U05 in [decisions](decisions.md)). The component mapping, interaction contract and phase allocation below are proposed implementation details. Existing ownership, role, retention, embedding and rendering decisions remain open. The package is not installed, and its React peer range does not prove compatibility with our full stack.

## Component integration plan

Keep Tailwind v4, shadcn/ui, Lucide and Tiptap. Performative UI supplies selected backgrounds, surfaces, accents and AI-facing compositions; shadcn/ui remains the base for forms, dialogs, menus, focus handling and accessible primitives. Tiptap remains the constrained resume text editor. This introduces no new service, MFE, AI provider, model selector or general chat product.

| Shared composition (proposed) | Component choice | Product behavior |
|---|---|---|
| ResumeIntentPrompt | PromptHero | Enter a short intent; choose create from profile or tailor to a supplied JD. Do not place resume/JD text in URL query strings. |
| ResumeSectionPrompt | Prompt | Show selected section/item, optional current JD, suggested actions and a bounded instruction input |
| SuggestionReview | shadcn/ui comparison/dialog/panel composition | Read accessible Before/After text, reasons and evidence; Apply, Discard or Retry |
| TaskFeedback | Shared status controls; selected Performative accents if verified | Honest queued/running/failed/ready states based on server events, no simulated AI progress |

### Backgrounds and broader component use — user-confirmed direction

The following component documentation was inspected in Chrome. Placement is a design proposal, not an approved full-page concept or a claim of tested integration.

| Component | Documented capability | Proposed placement and behavior |
|---|---|---|
| [Aurora](https://performative-ui.vercel.app/#/components/aurora) | Gradient blobs, custom palette, static and animated options | Preferred welcome/sign-in or dashboard-header backdrop; a restrained static variant can sit behind the editor workspace |
| [NodeGraphBackground](https://performative-ui.vercel.app/#/components/node-graph) | Canvas nodes/links with density, speed and cursor-effect controls | Optional alternative for a contained introductory area; evaluate rendering cost and turn off cursor effects for touch/reduced-motion use |
| [FloatingSparkles](https://performative-ui.vercel.app/#/components/floating-sparkles) | Configurable drifting glyph field | Optional bounded success accent or introductory decoration; stop/unmount after the intended effect |
| [GlassCard](https://performative-ui.vercel.app/#/components/glass-card) | Composable surface with hover glow and optional shadow animation | Welcome/action cards and assistant surfaces with contrast-tested opaque fallback; continuous breathing off while editing |
| [GradientText](https://performative-ui.vercel.app/#/components/gradient-text) | Gradient text with a static option | Short welcome/section accents; keep body text, form labels and document content solid and readable |

Other catalog components may be selected where they serve a real resume workflow, with the same F01/D13 checks. Selection does not authorize adding unrelated pricing, social-proof or general-chat features. Shared wrappers map all visuals to our tokens and states; no full-library import or conflicting second design system.

Decorative layers sit behind app content, cannot intercept input, convey no essential information and stay out of the accessibility tree. Pause/unmount animated canvas/CSS effects offscreen or in hidden tabs. Use a static or absent effect for reduced motion; measure actual rendering cost on narrow/mobile screens before enabling it. The resume page, rich-text reading surface and PDF remain opaque and decoration-free. An animated app background must never become a resume template background.

Do not use a decorative comparison slider as the only way to read text changes. Unsupported microphone, attachment and provider controls stay absent. A supplied JD and user instruction are untrusted inputs, not authority to expand tool access or edit other resources.

## Foundation acceptance gate

During authorized F01 work:

- Verify the actual published package/version and MIT notice obligations; pin the release and lockfile only after evaluation.
- Import public exports through `packages/shared`; do not scatter direct imports or copied component source across remotes.
- Review stylesheet selectors, global tokens, CSS ordering against Tailwind, and light/dark behavior. Define shell loading and standalone-remote loading so styles are available without conflicting injection.
- Check Vite 6/React 19/TypeScript and production Module Federation builds, shared React identity, bundle size, and remote-load failures. Do not silently upgrade the requested stack.
- Verify controlled input, accessible labels, IME composition, keyboard submission, touch interaction, focus restoration, reduced motion and readable contrast.
- Add wrapper-level busy/disabled/error handling and duplicate-submit guards; inspect supported APIs rather than assuming every native textarea prop is forwarded.
- Lazy-load optional decorative effects. Permit approved backgrounds around app content, keep editable text/document surfaces readable and opaque, stop effects offscreen/with reduced motion, and keep exported PDFs static and decoration-free.
- If a component cannot satisfy these checks, keep the selected library where suitable and record a local wrapper/replacement decision before changing the dependency direction.

No package installation, app configuration or component implementation is performed in context review.

## Capability mapping and boundaries

| Capability | resume-forge plan | Phase / feature |
|---|---|---|
| Build a resume from profile facts | Proposed basic builder mode without requiring a JD; manual section editing, one initial template, explicit save | 2 / F06, F08 |
| Tailor to a supplied opening/JD | Existing parsing and grounded full generation plus explicit selected-section improvements | 2 / F05–F08 |
| Click a section and request changes | Prompt context identifies a stable section/item; suggestion review precedes any saved edit | 2 / F06, F08 |
| Explain resume feedback | Evidence-backed ATS heuristic and actionable section links; no hiring verdicts | 2 / F07, F08 |
| Manage and revisit resumes | Saved versions, current status, continue editing, JD reuse, permitted download | 3 / F09–F11 |
| Update factual source data | Explicit master-profile editing separate from resume prompts | 1 / F04; 3 / F12 |
| Detailed missing-evidence analysis | Existing F17; supported recommendations can open the same section composer | 5 / F17 |
| Import an existing resume file | U06/F19 reviewed intake, separate from LinkedIn archives; D14 gates formats/processing | Phase 6 proposed |
| Template gallery and formatting | U06/F20 original templates, density, margins, spacing, typography, reset and bounded fit-to-page | Phase 6 proposed |

Original F01–F18 allocations remain stable; U06 adds proposed Phase 6 F19/F20. Interactive editing and dashboard work expand Phase 2/3 acceptance. None is complete or an estimate of unchanged effort. Voice input, job scraping, cover letters and competitor-specific scoring claims remain unallocated or excluded. See [capability coverage](resume-capability-coverage.md) for all observed controls and phase owners.

## Visual direction on hold

Preserve the requested modern presentation, responsive behavior and useful animations. Exact layout, palette, light/dark scope and motion intensity remain D06. Earlier Studio/Focus concepts are optional historical proposals, not a required choice or active deliverable. No additional concept is produced during this update.

Read [resume editing contract](resume-editing-contract.md) for selection, grounding, persistence, permissions and error semantics; use [UI context](ui-context.md) for routes and shared presentation rules.

## Comprehensive follow-up evidence — U06

Further signed-in inspection found dashboard Search, Name/Readiness Rating/Updated At sorting, page-size controls, Set as Active/Clone/Delete actions and Upload Resume/New Blank Resume entries. The customization panel exposed a gallery/category entry, compact-to-spacious presets, four margins, section/item spacing and font family/size/line-height/color for section headers, headings, subheadings and descriptions. No setting or resume content was changed in this follow-up; menu visibility does not verify persistence. Own search/clone/default semantics are proposed in F10; file intake and customization now have F19/F20 owners. See [coverage register](resume-capability-coverage.md) for unknowns and all mappings.
