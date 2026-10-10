# Forge UX/UI redesign

## Objective and current boundary

Use suitable Performative UI components throughout the existing resume experience, with an original Forge identity. CareerZenith remains a capability reference; its dark-purple rails, score treatments and dialog decoration do not define the new design. This document plans the UI work on **ux-ui-update** after PR #4; branch setup does not implement new visuals.

The [official catalog](https://performative-ui.vercel.app/) was inspected in the browser on 2026-10-10. It displays 33 components. The project already pins `performative-ui` **0.7.0** in packages/shared. Installed README, package exports and TypeScript declarations are the compatibility authority for implementation. No dependency upgrade is needed for this plan.

## Design direction

Forge is a private place to collect, refine and publish professional documents. Build a clear document workspace with an ocean-blue application frame, readable paper surfaces and teal actions. Give the resume itself visual priority. Distinction should come from the navigation, document presentation and review flow as well as color.

Use these six starting tokens, subject to contrast verification: canvas **#ECF2F5**, paper/surface **#FFFFFF**, primary ink **#102D3A**, secondary ink **#53717B**, action **#127C82**, and rule **#CDDCE2**. Derive dark-theme equivalents as a coherent set. Keep UI text in the existing system sans family; Georgia remains the document face. Do not change persisted resume typography as a side effect of application styling.

Left-align headings, controls and content. Use a strong, plain page title and clear action names. The library should look like a collection of working documents, with compact resume previews and straightforward recent activity. Avoid a large motivational banner or decorative metrics. Use distinct surface sizes according to purpose rather than identical cards everywhere.

Provisional library structure:

```text
Workspace navigation | Your resumes              Upload / Create
                     | Search and sort
                     | Document collection        Selected document
                     | Resume title and status    Preview and actions
```

Review against the brief: a generic gradient dashboard would still resemble an interchangeable resume SaaS template. The plan instead emphasizes document selection and a quiet preview desk. One restrained atmospheric layer may distinguish the task-launch surface; the document collection and paper stay calm. Final screen order can change when the user answers the preference question.

## Performative UI mapping

| Component | Intended job | Integration constraint |
| --- | --- | --- |
| Aurora | Contained atmosphere for welcome and document creation | Reuse AuroraBackdrop; static on mobile/reduced motion and paused when inactive. |
| GlassCard | Primary task-launch or contextual assistant surface | Reuse GlassCardSurface; opaque readable content, no breathing during editing. |
| Button | Principal create/upload/review actions | Wrap through packages/shared; preserve native button/link semantics, disabled state and focus. |
| StatusDot | Actual saved, draft, loading or error state | Reflect application state with a text label; color is never the only signal. |
| WibblingSpinner | Pending import, AI or export feedback | Show only while a real request is pending; retain readable status and reduced motion. |
| Prompt | Scoped description assistance and the JD composer | Reuse existing section adapter; keep selected-target and explicit-submit semantics. |
| PromptHero | Document intent where a real supported action exists | Reuse ResumeIntentPrompt; keep unsupported voice, attachment and model controls hidden. |
| BeforeAfter | Original/suggested wording comparison where it improves review | Retain del/ins and full-text review; verify keyboard access and mobile readability before use. |
| GradientText | A deliberate whole-title treatment on a contained welcome surface | Reuse GradientHeadingAccent; do not color one arbitrary headline word. |
| ChatBubble | Explanations already returned by an assessment | Use as a surface for real evidence; do not imply a chat service exists. |

These are candidate placements, not an instruction to manufacture workflows to increase component count. Marketing, pricing, social-proof and chat-launch components need a corresponding real product function. Shared shadcn-based dialogs/forms and Tiptap remain authoritative for accessible editing. Inspect a component's installed implementation as well as its types before wrapping it.

## First slice and acceptance

The provisional first slice is My resumes, followed by editor chrome and assistance panels. Preserve real library search/sort, create/upload/review, reopen, delete confirmation and saved PDF download. Keep existing backend APIs, identity, workspace authorization, versioning and scoring math intact. Resume paper and PDF output must remain independent of decorative UI layers.

Before implementation, inspect the current screens and write the concrete layout/token plan for the chosen screen. Then build a coherent complete flow and critique desktop/mobile screenshots. Verify keyboard focus, screen-reader names, contrast, reduced motion, no horizontal overflow at 390px, and real loading/error/empty states. Use synthetic records for shareable screenshots. Run affected shared/MFE builds and lint, plus the existing relevant tests. Record actual results and limitations in README and progress-tracker.
