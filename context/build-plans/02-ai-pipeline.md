# Phase 2 Build Plan — AI Pipeline

**Features:** F05–F08. **State:** Not started. **Goal:** Build a basic resume or tailor it to a JD, then review and apply grounded section-specific improvements.

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

Planned files: scoring core/task, versioned breakdown persistence, ATS UI.

- [ ] Implement the approved [F07](../feature-specs/07-ats-scoring.md) rubric and compatible semantic scoring.
- [ ] Handle partial/unavailable/stale results explicitly; label scores as heuristics.
- [ ] Verify arithmetic, evidence, and fixed-input examples independently of live model variability.

## Task P2.5 — Preview and initial template (F08)

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
