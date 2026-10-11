# F01 — Design System

## Audited status — 2026-10-11

**Done for foundation scope.**

- [x] ✅ Shared tokens, shadcn-style controls, Performative adapters, React federation, responsive shell, device/light/dark theme and static/reduced-motion fallbacks. [Source](../../packages/shared/src/index.ts).

**Remaining:** Full assistive-technology and sustained low-end rendering audits are release checks, not established by historical broad checkboxes.

This snapshot supersedes dated implementation/pending statements below. Full acceptance stays unchecked where integration or verification is missing. [Complete audit](../../docs/implementation-audit.md).

**Phase:** 1 — Foundation · **Priority:** Critical · **Implementation:** Done for foundation scope (audited 2026-10-11)

## Goal and dependencies

Give the shell and all three remotes one accessible visual language that satisfies the user's modern-interface and animation requirement. Read [UI context](../ui-context.md) and [Performative UI integration](../frontend-integration.md), resolve D06 and validate D13, and complete the toolchain/federation compatibility check in the [Phase 1 plan](../build-plans/01-foundation.md). No dependencies are installed during context review.

## Ownership and planned files

`packages/shared/src/components/ui/`, `packages/shared/src/styles/`, `packages/shared/src/utils/`, `apps/shell/src/`, and each remote's browser entrypoint. Public exports use `@resume-forge/shared`; apps consume the same tokens and component APIs.

## Build scope

1. Define approved tokens, typography, spacing, focus states, and document-vs-application surfaces.
2. Configure Tailwind v4 and shadcn/ui for the Vite monorepo; expose a shared stylesheet and `cn()` helper.
3. Add only the primitives required by the first flows, with accessible labels, keyboard behavior, and error/loading variants.
4. Build a shell navigation/layout preview with a remote component and an error fallback. Keep private/authenticated screens as future feature work.
5. Verify shared React instances, CSS loading, and component styling in production federation builds, not just dev servers.

## States and limits

Provide button loading/disabled states, form errors, cards, dialogs, empty states, toasts/status announcements, and skeletons. Keep the scope focused on the resume workspace; a marketing site and diagramming controls are outside this feature. Proposed theme values are not approved until D06 is resolved.

## Acceptance and verification

- [x] Shell and remotes render the same tokens without duplicate conflicting CSS or React runtimes.
- [x] Controls work with keyboard navigation, visible focus, accessible names, and disabled/loading states.
- [x] Layout remains usable on narrow screens and with zoom/long content.
- [x] Token contrast and font licensing are checked for the actual chosen design.
- [x] Approved motion works with keyboard interaction and reduced-motion settings; chosen themes are visually verified without delaying controls.
- [x] Shared package typecheck and affected production builds pass; visual review is recorded.

No OAuth, profile persistence, resume generation, or expanded template library belongs in this feature.

## Performative UI foundation — 2026-09-29 planning update

Add shared PromptHero/Prompt wrappers, selected-context labels, action chips, an accessible comparison surface and real request state controls. Include suitable Performative UI backgrounds, GlassCard surfaces and gradient accents alongside shadcn/ui/Tiptap and the existing token system. Aurora is the proposed default atmospheric effect; other catalog choices follow the integration document. Verify D13 before pinning or integration; visual layout/theme/placement remain D06. F01 uses synthetic UI states only; provider calls and persistence belong to Phase 2.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [x] Controlled input, IME/keyboard submit, optional toolbar removal, busy guards, token/CSS loading and reduced motion pass shell/remote production review.
- [x] Backgrounds/surfaces preserve contrast and pointer/focus behavior, use static/absent reduced-motion fallback, stop rendering offscreen/in hidden tabs and stay within a measured mobile rendering budget.

## Usability refinement and verification limits — 2026-09-30

Revisited the earlier completed foundation after the user rejected its crowded presentation. The current UI uses shared styles, focused routes, responsive document/assistant views, honest preview states and concealed diagnostics. Browser evidence is recorded in [UI review](../../docs/ui-redesign-review.md). Narrow mobile, tablet, desktop, native radio keyboard control, section focus, profile validation, dark document isolation and synthetic failure recovery were checked. This is not a comprehensive screen-reader, IME, performance-budget or real authorization test; the earlier broad acceptance checkboxes must not be read as new evidence for those checks.

## Device theme default — 2026-10-10

The authenticated shell and sign-in app default to `prefers-color-scheme`, with device/light/dark selection in Preferences and a browser-local manual override from existing theme toggles. Device changes update system mode; manual mode stays fixed across reload when storage is available. Theme is resolved before initial React mounting and propagated through the existing light/dark federation contract. White resume/PDF surfaces remain independent.

Five new shell regressions cover device/override/reset behavior, persistence, invalid/blocked storage and observer cleanup. All 15 shell tests, shell build/typechecking, lint and whitespace validation pass. Chrome verifies the dark-device default and override/reset reload paths; live OS setting changes and standalone remote presentation were not retested.
