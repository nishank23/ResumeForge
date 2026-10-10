# Phase 2 Build Plan — AI Pipeline

## Scoped rewrite follow-up — 2026-10-10

Reproduced and fixed safe-word rejection for the selected final-CV role. Shared prompt/validator vocabulary, word-level review and explicit action buttons replace consent checkboxes. Existing paid-mode, professional scope and immutable-version policy remain. Generation is bounded to 20 seconds; embeddings remain eight. This completes only the requested repair/UI slice, not durable tasks or full generation. [Verification](../../README.md#gemini-rewrite-repair-and-inline-review--2026-10-10).

## Current Gemini migration — 2026-10-09

Paid gemini-3.5-flash-lite now handles grounded JD correspondence and selected wording. OpenCode SDK/process/HTTP and unused Textkernel runtime are removed. Approved deterministic rubrics, private 768-dimensional embeddings, authorization, consent, reviewed immutable-version Apply and failure boundaries remain. ATS feedback groups into five expandable areas; JD editing/evidence collapse after a result. Model identity is checked at both assessment replay boundaries. Eight-second bounded provider calls remain a local slice; durable jobs/full generation/shared roles are incomplete. [Current workflow](../../docs/ats-workflow.md).

## Historical bounded JD/rewrite slice — 2026-10-09

Approved JD rules, optional paid Gemini correspondence, exact-entry Fix and persisted reviewed MiMo apply are implemented in the personal runtime. Gemini never rewrites and MiMo never scores. Live free-model access is blocked by OpenCode own-client restriction. The requested current-version Gemini/pgvector retrieval and official OpenCode SDK adapter are implemented. SDK/CLI 1.18.35 are pinned; live SDK generation still returns 403 FreeTierError. Eight-second HTTP/embedding and 45-second SDK synchronous calls are a bounded local slice; they do not replace the planned durable Trigger.dev pipeline or complete Phase 2. Shared roles, durable jobs, broader parser/quality checks and full generation remain pending. Earlier pending-JD/provider notes are historical. [Current contract and evidence](../../docs/ats-workflow.md).

**Current implementation — 2026-10-03:** V01 and local E01–E05 canvas-first manual editing are complete. Direct paper fields, Summary/description Tiptap, validated section/entry dialogs, grouped Skills/Languages, contextual move/edit/hide/delete, empty-only fictional sample autofill and full-draft local history are verified. The duplicated Edit Content sidebar is removed; keyboard/click selection reveals actions and mobile uses the same paper. [Tracker](../progress-tracker.md) and [verification](../../docs/manual-editor-verification.md) distinguish this synthetic, in-memory UI from pending real contacts/D12, durable blank/profile versions, grounded AI, ATS and PDF. Earlier slice descriptions below are dated history.

**Features:** F05–F08. **State:** Backend/AI not started; V01 and local E01–E05 canvas-first F08 editing verified 2026-10-03. **Goal:** Build a basic resume or tailor it to a JD, then review and apply grounded section-specific improvements.

## Entry conditions

Phase 1's identity, profile, persistence, and isolation contracts pass. Resolve D07 for semantic models, D09 for scoring, and D12 for content/header privacy. Provider credentials and task environments are configured server-side under authorized development work.

## Task P2.1 — Durable task and AI contracts

Planned files: `packages/ai-provider/src/`, shared JD/resume/ATS schemas, `trigger/`, resume-service TaskRun orchestration.

- [ ] Configure provider adapters, structured output schemas, versioned prompts, input minimization, and bounded retry/cost/concurrency limits.
- [ ] Implement dispatch intent, run ownership, run-scoped token issuance, sanitized status, and retry reconciliation.
- [ ] Verify a synthetic task survives the chosen failure/retry cases without exposing private output.

## Task P2.2 — JD parsing (F05)

Planned files: parser core/provider prompt, parse task, JD service routes and persistence.

- [ ] Implement [F05](../feature-specs/05-jd-parser.md), including scope/input limits and source-grounded parsed fields.
- [ ] Save/retrieve parsed JDs and handle malformed output/provider failure without false success.
- [ ] Validate prompt-injection fixtures and idempotent parse behavior.

## Task P2.3 — Fact mapping and generation (F06)

Planned files: content mapper/generator, generate task, resume/version persistence and routes.

- [ ] Snapshot profile/JD revisions, select supported facts, and implement [F06](../feature-specs/06-resume-generator.md).
- [ ] Enforce output/provenance validation and immutable version commits.
- [ ] Test dispatch replay, revoked access, deletion during a run, concurrent completion, and unchanged master profile.

## Task P2.4 — Scoring (F07)

Current 2026-10-09 status: approved deterministic general readiness is implemented separately. The user withdrew Textkernel after a corporate-email signup barrier; do not continue its account/indexing/live integration plan. Retain `jd-match-v1` result/adapter foundation; the existing vendor adapter remains disabled. Local JD scoring with optional Gemini analysis is recommended, not activated. Resolve the custom JD rubric and permitted real-data mode before dependent implementation. Odoo hosted free plans lack external API access. No live JD route, persisted evaluation or JD UI activation exists. P2.4/F07 remains partial. See [provider scope and manual verification](../../docs/ats-providers.md).

Planned files: scoring core/task, versioned breakdown persistence, ATS UI.

- [ ] Implement the approved [F07](../feature-specs/07-ats-scoring.md) rubric and compatible semantic scoring.
- [ ] Handle partial/unavailable/stale results explicitly; label scores as heuristics.
- [ ] Verify arithmetic, evidence, and fixed-input examples independently of live model variability.
- [ ] Deliver E08's Readiness Rating and Pending/Completed/Deleted tabs with Fix/View/Reason/Dismiss/Restore, exact-version evidence and truthful unavailable/stale states. D09 governs real ratings; [frontend editor plan](../../docs/frontend-editor-plan.md) defines the requested UI.

## Task P2.5 — Preview and initial template (F08)

### Frontend-first manual summary slice — authorized 2026-10-03

The user brought this bounded frontend slice forward while Phase 1 continues. Its dependencies are the completed F01 shell/shared UI and protected routing; it uses synthetic, contact-free content only. F06 generation, D12 real headers and durable resume storage remain prerequisites for the full F08 feature.

- [x] Compact editor workspace with section tools beside one clean original resume layout.
- [x] Two synchronized constrained Tiptap summary inputs, Editor/Preview, local Save/Cancel and shared undo/redo.
- [x] Verify desktop/mobile/keyboard operation and label the in-memory checkpoint honestly; no browser storage, API mutation, AI or export. Evidence and manual checks: [local editor verification](../../docs/manual-editor-verification.md). Full P2.5/F08 remains incomplete.

Design: retain cobalt `#4338CA`, ink `#172033`, muted `#536079`, canvas `#EEF1F6`, paper `#FFFFFF` and divider `#E0E4EC`. System UI is for tools; Georgia gives the resume name a document identity, with restrained sans-serif body text. A compact action strip sits above a left-aligned section panel and centered paper. The document is the main visual; selection outlines appear only while editing. Review against the brief removed the large heading, duplicate notices, card borders inside the resume and decorative gradients from this focused workspace. This does not activate the F20 gallery or other manual section forms.

### V01 document design — authorized and verified 2026-10-03

The user's later instruction brought this visual slice ahead of E01. It supersedes the initial paper typography/selection treatment above. [Design tokens and acceptance](../../docs/frontend-editor-plan.md#v01--resume-document-design) and [verification](../../docs/manual-editor-verification.md#v01-verification--2026-10-03) document the boundary.

- [x] Centered name/headline/synthetic contact line on white paper, readable serif text, thin section rules and aligned dates.
- [x] Consistent bullets and compact Skills groups; Summary, Experience, Education, Projects, Skills and Languages render through a display-only local fixture.
- [x] Keep controls outside paper and preserve Summary/history/authentication; verify desktop/mobile/keyboard, dark-theme paper and long content without clipping.

No real UserContact projection, durable storage, other field forms, AI, ATS rating or PDF pipeline was implemented. P2.5/F08 remains partial. E01 is the next manual editing slice.

### Local E01–E05 manual follow-up — verified 2026-10-03

The user's five screenshots and explicit field/action list are documented in the [frontend editor completion plan](../../docs/frontend-editor-plan.md), with reusable [development prompts](../../docs/development-prompts.md). The user subsequently authorized the connected manual flow, including canvas-first editing and fictional sample autofill. These local checks are complete; protected service integrations remain separate:

- [x] E01: local Work Experience entries and reusable accessible Edit dialog with target-only Save/Cancel, validated dates, synchronized rendering and shared history.
- [x] E02: local First/Last Name, professional headline and City/State/Country header fields.
- [x] E03: local Education and Project repeated-entry forms with validated dates, optional grade and safe links.
- [x] E04: categorized Skills and separate Languages.
- [x] E05: contextual edit/move/visibility/delete controls for stable supported targets, with keyboard/click alternatives, 44px mobile targets and local undo/redo. Actual touch hardware remains untested.
- [x] E05 clarification: Summary's inline toolbar omits movement arrows; out-of-range entry/bullet moves show an accessible highest/lowest-position error popup with no content, selection, dirty-state or history changes. Verify first/last/single-item and stale-target guards separately from successful movement.

Real Phone/Email and durable draft/version recovery are E06, dependent on D12 and protected contact/resume services. E07 uses P2.6's grounded AI contract; E08 uses P2.4/F07; E09 is F09's Phase 3 exact-version private PDF flow. Required UI controls must show honest unavailable states until their backing feature exists. No F20 gallery, file-intake or arbitrary canvas expansion is implied.

Planned files: template registry/renderer contract, resume-MFE editor/preview, version-save use case.

- [ ] Implement [F08](../feature-specs/08-resume-preview.md) with one versioned template, constrained text editing, and responsive preview.
- [ ] Apply authorized header composition and current-access policy to historical versions.
- [ ] Verify long/Unicode documents, schema/template errors, and conflicts; integrate score/status display.

## Task P2.6 — Contextual resume builder (F06/F08)

Planned areas: shared prompt compositions, resume-MFE section controls/review UI, resume-service suggestion use cases, typed core/provider contracts, task and proposal persistence.

- [ ] Create a profile-derived basic draft without a mandatory JD/AI call; absent JD scores are unavailable.
- [ ] Bind explicit section/item selection and custom/quick-action prompts to a persisted base version and optional parsed JD.
- [ ] Dispatch a grounded scoped suggestion, preserve the current version and provide private review/status recovery.
- [ ] Implement readable comparison, Apply/Discard/Retry, conflict handling and restoration as a new version.
- [ ] Verify target-only changes, immutable master/history, idempotent Apply, contact privacy, stale/late responses, authorization and honest score freshness.

This is required Phase 2 work under [editing contract](../resume-editing-contract.md), expanding the exit gate beyond full-resume generation. F07 evidence links open a target without automatically submitting. Detailed gaps remain F17.

## Exit gate

A saved profile supports a basic draft; adding a JD supports an attributable tailored version and approved five-part score. Section suggestions can be reviewed and applied safely in the editor. Grounding, retries, run tokens, privacy, and version integrity are verified. The profile remains unchanged. R2 PDF export and management screens are Phase 3; they are not falsely marked done by preview rendering.

## U06 coverage additions

- [ ] F06/F08 support blank/profile drafts, typed optional sections, keyboard reorder, manual Save/Cancel, local undo/redo and responsive preview/page count.
- [ ] F07 issue reasons and open/resolved/dismissed states retain immutable evidence; Fix only opens the appropriate editing flow.
- [ ] Resume-local user-confirmed facts have provenance and never write the master profile; contact fields remain protected.

Local implementation also includes direct paper fields, isolated dialogs, empty-only explicitly fictional autofill preserving typed values/IDs, and full-draft checkpoints/history. See [actual verification](../../docs/manual-editor-verification.md#e01e05-canvas-first-verification--2026-10-03); these checks do not complete persisted P2.5/F08.
