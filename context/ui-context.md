# UI Context

## Current implementation — 2026-09-30

The user requested direct UI/UX improvement on 2026-09-29. F01 now uses a document-focused personal preview: sidebar navigation, a resume library entry route, separate creation/editor pages, a white resume beside a section assistant, and mobile view controls. Shared tokens use canvas `#F7F8FA`, surface `#FFFFFF`, muted surface `#EEF1F6`, ink `#172033`, secondary ink `#536079`, and indigo `#4338CA`. Dark chrome is retained, with `#A5B4FC` primary and `#172033` button text. System sans serves the UI; installed Georgia serves document illustration headings. No external font download.

Performative UI remains installed and wrapped. Static Aurora is restricted to welcome/create/sign-in areas; sample suggestions use an explicit request/review/apply flow. Diagnostic tools live under Preferences. All visible state is synthetic and session-local; no persistence, authorization or provider integration is implied. See [review and verification](../docs/ui-redesign-review.md). Earlier proposals below are historical guidance, not evidence of additional implementation.

## Design status

The user requested a **modern frontend with attractive animations** and selected **Performative UI**, including backgrounds and other suitable components alongside shadcn/ui, on 2026-09-29. Visual concept work is paused. Layout, palette, theme scope and motion details remain **proposed (D06)**; no Studio/Focus choice is required now. Use [frontend integration](frontend-integration.md) for verified component and signed-in editor observations and [contextual editing](resume-editing-contract.md) for the selected-section workflow.

Use a modern, readable document workspace: clear typography, compact navigation, subtle depth, visible save status, and a white resume page. Keep hiring-related terminology out of navigation. A responsive document workspace with contextual editing is the functional direction; sidebar/top navigation, accent and light/dark scope remain undecided. The printable resume stays white with dark text. The existing token table below is the proposed light palette; define and verify the dark palette if both themes are approved.

## Proposed tokens and typography

| Role            | Token                  | Draft value |
| --------------- | ---------------------- | ----------- |
| Page            | `--background`         | `#F6F7FB`   |
| Surface         | `--surface`            | `#FFFFFF`   |
| Muted surface   | `--surface-muted`      | `#EEF1F7`   |
| Primary text    | `--foreground`         | `#172033`   |
| Secondary text  | `--muted-foreground`   | `#536079`   |
| Border          | `--border`             | `#D8DEEA`   |
| Primary action  | `--primary`            | `#4338CA`   |
| Text on primary | `--primary-foreground` | `#FFFFFF`   |
| Destructive     | `--destructive`        | `#B42318`   |
| Success         | `--success`            | `#157347`   |
| Warning         | `--warning`            | `#8A5200`   |

Define tokens centrally in `packages/shared/src/styles/`; components use semantic utilities. Validate actual foreground/background combinations during F01, including muted text and focus rings. Token values are not a contrast certification.

Proposed UI font: a system sans stack to start; optional licensed brand fonts need explicit selection. Resume fonts are template assets with an explicit embedding/license policy. Use a 4px spacing base, 8px control radius, 12px cards, and restrained elevation. These are draft design values.

## Shared controls

Use shadcn/ui primitives for Button, Input, Textarea, Label, Card, Dialog, AlertDialog, Tabs, Select, Checkbox, DropdownMenu, Table, Skeleton, Tooltip, and ScrollArea as needed. Use Lucide icons with text or accessible labels. Wrap primitives for project-specific patterns instead of copying controls into each remote. Add selected Performative UI components through the same shared package: PromptHero for resume intent, Prompt for multiline section instructions. Keep shadcn/ui for accessible primitives and Tiptap for text editing. Hide unimplemented voice, generic attachment and model-selection controls.

Required shared patterns: field/error message, loading button, empty state, retry state, permission denial, confirm-delete dialog, save indicator, score breakdown, task stage indicator, and workspace selector. UI permission visibility helps users understand available actions; the server remains authoritative.

## Backgrounds, surfaces and accents

Use Performative UI beyond prompt inputs: Aurora is the proposed primary atmospheric backdrop, GlassCard can style welcome/action and assistant surfaces, and GradientText can accent short headings. NodeGraphBackground and FloatingSparkles are optional contained effects after performance/accessibility checks. shadcn/ui continues to own the core controls and interaction semantics. Exact component placement and theme remain D06.

Backgrounds can decorate the sign-in/welcome area, dashboard header and outer workspace; they stay behind opaque form/editor surfaces. Do not place animation behind resume text or include app effects in PDF output. Decorative layers cannot intercept clicks or enter the accessibility tree. Use static/absent effects for reduced motion, pause offscreen/hidden-tab animation, and keep mobile rendering cost bounded. See the component mapping in [frontend integration](frontend-integration.md).

## Screens and proposed routes

| Screen / route                                                                   | Owner       | Main content and states                                                                                                       |
| -------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`, `/auth/callback/:provider`                                           | Auth MFE    | Google/LinkedIn buttons, cancellation/error/retry, session bootstrap                                                          |
| `/onboarding`                                                                    | Profile MFE | Stepper, draft/save state, repeated sections, final review                                                                    |
| `/w/:workspaceId/profile`                                                        | Profile MFE | Master profile sections and separately permitted contact                                                                      |
| `/w/:workspaceId/resumes`                                                        | Resume MFE  | Empty state or paginated resume list, create action                                                                           |
| `/w/:workspaceId/resumes/new`                                                    | Resume MFE  | Create from authorized profile or tailor to pasted JD; PromptHero intent entry, one initial template, explicit submit         |
| `/w/:workspaceId/resumes/:resumeId`                                              | Resume MFE  | Version selector, section/item controls, contextual Prompt, suggestion comparison/apply/discard, preview, score/PDF freshness |
| `/w/:workspaceId/jd-history`                                                     | Resume MFE  | Parsed JD summaries, pagination, detail, reuse                                                                                |
| `/w/:workspaceId/settings`, `/members`, `/audit` under the same workspace prefix | Shell       | Phase 4 settings, membership management, authorized audit view                                                                |

Routes are proposed contracts, not existing pages. Resolve workspace type and membership on the server rather than trusting a route param. A personal workspace can show simpler labels without concealing scope in the request layer.

## Interaction flows

- **Onboarding:** identity/contact → experience → education → skills → optional projects/certifications → review. Allow users with no work experience to complete a valid profile. Preserve server drafts across sessions; avoid private contact in persistent browser storage.
- **Basic builder:** create a draft from profile facts without a JD; no fabricated ATS score. Add a parsed JD for tailoring/scoring. Blank/manual entry also needs no JD. File intake has a proposed Phase 6 F19 entry only after D14 and implementation checks pass.
- **Generation:** show stages with honest status rather than an invented percentage. Prevent accidental duplicate submission and provide retry after a terminal failure. Navigating away must not discard the server run.
- **Editing:** clearly separate “Edit master profile” from “Edit this resume.” Select a stable section/item → choose an action or enter a prompt → explicitly request a suggestion → compare → Apply or Discard. Selection alone never calls AI. Apply creates a new saved version; manual unsaved edits must be saved/discarded before requesting a suggestion. Stale results require re-review, and restore creates a new version. See [editing contract](resume-editing-contract.md).
- **Preview:** editor and white page side by side on wide screens; tabs on small screens. Show current version, stale score/PDF indicators, page count, and selectable content. The initial template uses a simple single-column structure.
- **Privacy:** omit restricted fields; explain unavailable actions without exposing values. Never render hidden private data in DOM attributes, tooltips, downloaded files, or query caches.
- **Workspace switch:** indicate the target workspace, clear stale content, load scoped data, and handle access lost during the transition.

## Accessibility and responsive review

Proposed motion: subtle hover/press feedback, short page/panel transitions, smooth onboarding step changes, section reordering, and a settled reveal after generation completes. Stage indicators must follow real task events. Respect reduced-motion settings and keep reading/editing immediately available. Detailed timing and interactions are in [the motion proposal](phase-1-decision-review.md#proposed-motion-language). Performative UI is selected but not installed; extra animation dependencies remain an implementation choice under D13. Background effects are permitted in suitable app regions, with calm reading/editing surfaces and static print output.

Keyboard access, labeled form controls, logical focus order, dialog focus restoration, announced errors, and status text must work throughout. Scores/statuses require text labels in addition to color. Respect reduced motion; use scalable text and responsive controls. Verify desktop, narrow mobile, zoomed layouts, long names/JDs, keyboard-only flows, and screen-reader announcements during implementation.

PDF layout has its own verification: readable fonts, sensible page breaks, text extraction, stable margins, and no clipped or concealed content. See F08/F09 and [validation-strategy.md](validation-strategy.md).

## U06 expanded flows

[Coverage](resume-capability-coverage.md) maps blank/profile creation, typed section editing, actionable issues, list search/sorting, rename/clone and active-resume preference. Proposed Phase 6 adds reviewed upload plus template gallery, density presets, margins, spacing, typography/color, reset and bounded fit-to-page. Keep controls disabled/absent until their backing feature exists. Distinguish app decoration from document appearance: Performative UI accents do not become resume page backgrounds. Visual concept work is still paused.
