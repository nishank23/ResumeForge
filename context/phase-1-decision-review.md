# Phase 1 Decision Review

Prepared: 2026-09-28. Updated: 2026-09-29. **Recommendations for discussion; no development authorized and no open decision approved by this document.**

The user’s confirmed requirements now include Performative UI and section-context resume prompts. Visual concept work is paused; no Studio/Focus selection is requested now. Layout, theme, colors and animation intensity remain open. See [current frontend integration](frontend-integration.md) and [editing contract](resume-editing-contract.md).

## What needs deciding now

Scaffolding does not require every future product question to be answered. The important boundaries are: visual direction before F01, ownership/schema choices before F03 migrations, and sessions/environment configuration before F02 sign-in. The original five phases and stack remain the foundation baseline; proposed Phase 6 F19/F20 does not block Phase 1.

| Decision | Plain-language question | Recommendation | Why / tradeoff | Required before |
|---|---|---|---|---|
| D03 — Profile ownership | Does a person maintain one profile or a different copy for every organization? | One user-owned master profile, with explicit, revocable access grants to workspaces. Membership alone grants no profile access. | Avoids duplicate profiles becoming inconsistent. Sharing/revocation needs deliberate policy and checks. Separate copies provide independence but add duplicate edits and conflict handling. | Profile relations and F03 migration |
| D04 — Workspace model | How do we keep personal, organization, and vendor data separate? | One common Workspace record with a type; organization/vendor details link to it. Every resume, JD, and run resolves to a workspace. | Gives every service one reliable workspace ID and enforceable parent relations. The UI still shows the three distinct workspace experiences. | Tenant schema and F03 migration |
| D08 — Sign-in and sessions | How does a login remain secure, and can Google/LinkedIn represent the same person? | Preserve both providers; identify accounts by provider plus provider user ID. Use explicit authenticated linking, short-lived access credentials, and rotating/revocable refresh sessions. | Supports reliable logout and reduces accidental account merging. Requires session persistence and replay handling. Do not merge solely because emails match. | Session schema and F02 |
| D11 — Activity records | How do we know who accessed or changed private data? | Capture minimal attributable events from the first private routes. Persist mutation event intent with the database change, retry internal delivery, and deduplicate by event ID. Require durable capture for protected contact access. | Avoids losing audit events during service outages without storing full private payloads. A protected contact read may need to fail safely if its event cannot be captured. | Audit persistence and first sensitive routes |
| D06 — Look and feel | What should the product feel like? | Modern document workspace with Performative UI prompts and useful motion; settle exact tokens/themes when design review resumes. | Component choice is confirmed; visual concepts are paused and no layout is approved. | F01 final tokens |
| D10 — Development environment | Where should we run the first version? | Begin with local apps/services and separate development resources for required hosted integrations. Choose the production container host/region later. | Lets foundation work progress without an early hosting commitment. OAuth redirect URLs, cookie/site boundaries, and provider credentials still need definition before real sign-in testing. | P1.1 local setup; F02 actual callbacks |
| D07 — Semantic search setup | Which model turns profile/JD text into comparable vectors? | Treat this as an engineering validation during the compatibility work. Choose a supported model, verify its dimensions and matching space, then define columns/indexes. | Prevents locking the database to the source plan's unverified 1536/384 assumptions. No model or replacement dimension is selected here. | Vector migration; not a prerequisite to discussing or scaffolding UI |

## Important details of the recommendations

### Profile grants

A user can share professional information with a workspace without sharing contact information. Read access and write access are separate grants; a role alone must not allow someone to edit the master profile. Workspace resume edits never write back to it. Existing generated versions remain snapshots.

Recommended revocation behavior for review: stop future in-app access by that workspace to the shared profile and its derived resume/artifact resources; recheck queued jobs and download requests. Already downloaded files cannot be recalled. Confirm this behavior before implementing grants, since it affects organization expectations.

### Browser sessions

Proposed browser transport: refresh credentials in Secure, HttpOnly cookies, short-lived access credentials in memory, and server-side refresh hashes with rotation/revocation. Apply CSRF protection and explicit origin rules to cookie-authenticated operations. Final cookie attributes/domain routing must match the actual development and deployed site topology. Do not put refresh credentials in persistent JavaScript-readable storage.

This security direction follows [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html); exact lifetimes and deployment settings remain implementation decisions to verify before auth release.

### Audit and retention

Audit records identify actor, action, workspace, resource, timestamp, outcome, and correlation ID. Exclude raw resume/JD/contact content, tokens, and signed URLs. Proposed database outboxes deliver over internal HTTP; no separate message broker is introduced.

The immediate decision is the event/durability boundary. Choose explicit retention/deletion periods before using real personal data in a deployed environment; do not silently retain everything forever. Operational logging and business audit retention are separate policies. See [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## Decisions that can wait

| ID | Proposed direction | Revisit |
|---|---|---|
| D01 — Billing | No billing implementation in Phases 1–5; keep future billing open | Before expanding product scope |
| D02 — Vendor onboarding | Explicit invitation acceptance and revocable profile access | Before shared-workspace onboarding; keep compatible schema hooks |
| D05 — Full role mapping | Preserve source restrictions; deny vendor contact access by default until the policy is reviewed | Before Phase 4 activation |
| D09 — ATS rubric | Review the proposed five-component, versioned heuristic; avoid promising external ATS or hiring results | Before F07 |
| D12 — PDF/contact rendering | Preserve separate contact data now; review protected header snapshots and privacy-specific export variants | Before F06 content schema/F08 preview/F09 export |

These are deferrals to named gates, not approvals. D03, D04, D08, and D11 affect schemas early; settle those before building their dependent persistence.

## Earlier frontend proposals — paused, not selected

### Studio — previous proposal

A compact left sidebar anchors navigation between resumes, profile, and JD history. The main area gives resume thumbnails and the primary action room to breathe. Opening a resume leads to an editor with document preview and contextual analysis. The same shell can accommodate workspace settings later without redesigning navigation.

Use an indigo accent, restrained depth, rounded controls/cards, strong type hierarchy, and light/dark tokens. In the final product the printable resume remains a white page with dark text regardless of the app theme.

### Focus — alternative

A smaller top navigation and a document-first layout. A compact contextual panel contains profile/JD controls while the resume occupies the main canvas. This emphasizes writing and tailoring; large workspace/member administration will need more secondary navigation.

Earlier concept work was set aside at the user’s request. It is not a review prerequisite and is not evidence that Phase 2/3 features exist. Phase 1 will build the chosen visual foundation, sign-in, and profile wizard.

## Proposed motion language

| Interaction | Proposed animation | Purpose |
|---|---|---|
| Buttons and resume cards | 120–180ms color/elevation change; subtle 1–2px lift | Acknowledge hover/press without moving surrounding layout |
| Navigation and editor panels | 180–260ms fade plus short translation | Show where the selected content appeared |
| Onboarding steps | 220–300ms directional slide and progress indicator transition | Make forward/back movement clear |
| Tailoring task | Stage changes driven by actual task events; a single settled document reveal | Show progress honestly; never fabricate percentage completion |
| Resume section ordering | Short layout transition after a user action | Preserve visual context during rearrangement |
| Save completion | Small checkmark/text transition after confirmed persistence | Give reliable feedback without interruption |

Keep all controls immediately usable; motion must not delay saving or reading. Avoid perpetual background movement, automatic document scrolling, and typing effects that conceal readable content. Follow the user's reduced-motion preference, replacing large movement with immediate updates or a brief opacity change. [Motion's accessibility guidance](https://motion.dev/docs/react-use-reduced-motion) supports adapting animation to that preference.

CSS transitions are sufficient for basic feedback. Motion for React is a candidate for coordinated layout transitions, to be evaluated during F01; it is not installed or added to the confirmed stack here.

## Choices to record next

1. Accept the shared-master, common-workspace, session, audit, and local-development recommendations, or specify which decision to change.
2. Review the proposed section selection → prompt → comparison → Apply flow and JD-optional basic builder in the linked contract.
3. Keep D06 visual choices paused; verify D13 during future F01 compatibility work. D14 resume-file details can remain deferred until proposed Phase 6 F19; the capability is now captured under U06.

Record answers against their decision IDs before changing status. Selecting these planning options does not authorize development; the user has explicitly asked to keep development stopped during review.
