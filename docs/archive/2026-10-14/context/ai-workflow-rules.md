> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Development Workflow

## Current audit snapshot — 2026-10-11

Development is authorized on docker-setup in the existing frontend worktree for the requested full local Docker setup. Task state belongs in context/development-status.md. Preserve primary-checkout private configuration and avoid competing runtime credentials. Current audit status overrides obsolete next-slice and paused-design instructions.

[Implementation audit](../docs/implementation-audit.md) provides completion checklists, source, gaps and priorities. Dated observations and original target designs below remain historical evidence or future acceptance.

## Current scope

The context-review gate was cleared by the user on 2026-09-29. Development is authorized within the approved scope and current tracker; earlier planning-stage pauses do not reopen that gate. Follow dependencies and resolve open decisions at the slice that requires them.

The source plan is a working planning baseline. Current context documents resolve its ambiguities and define the intended implementation. Commands in planning documents describe future work; execute them only within the user's authorized scope. The 2026-10-03 request authorizes tracker-driven scheduled development and local PostgreSQL/pgvector setup, with AI credentials forthcoming. Follow the [internal task marker](../../../../context/development-status.md) and [scheduled development procedure](../docs/scheduled-development.md) to claim/release one slice and skip ongoing work.

## Before a feature

1. Read root AGENTS.md, core context, the tracker, and the feature's phase plan.
2. Confirm development is authorized and the feature's dependencies are complete.
3. Review decision IDs referenced by the feature. Resolve blockers before implementing dependent behavior; do not silently choose a consent or sharing policy.
4. Inspect relevant code with CodeGraph when indexed. Docs and unindexed configuration can be read directly.
5. Identify the smallest verifiable slice, its affected services, contracts, and meaningful checks.

Feature numbers identify scope, not an unconditional execution order. F03 database contracts precede persisted F02 OAuth/F04 onboarding, while F01 UI foundation can be developed independently after its design decision is settled.

## Implementation loop after authorization

1. Mark the feature or slice in progress and record the intended change.
2. Update contracts when needed, then implement the slice against its acceptance checklist.
3. Verify successful, unauthorized, invalid-input, and relevant failure/retry cases.
4. Run affected type/lint/build checks and the feature's meaningful tests. Fix failures caused by the change.
5. Update specs, decisions, phase task checkboxes, and the canonical tracker with evidence.
6. Move to the next dependent slice only when the current contract is usable and no invariant is violated.

Split work at a coherent outcome: for example, task creation/token authorization before AI generation, or contact-free rendering before privacy-specific PDF persistence. Avoid unrelated refactors during a feature.

## Missing requirements and changes

Classify uncertainty as an implementation choice, a proposed design detail, or an open product decision. Routine reversible implementation details can use engineering judgment once development is authorized. Product decisions affecting consent, ownership, contact visibility, or scope need an explicit recorded resolution.

If a new requirement changes a confirmed decision, update decisions.md, the affected specification, and the build plan together. Keep any changes to the source-plan baseline explicit. Do not silently add features or promote deferred work into an earlier release.

## Done means evidenced

A feature is complete only when its acceptance criteria are implemented, relevant checks are recorded, known limitations are stated, and dependent docs are updated. A stub, mock, written spec, or successful compile alone does not prove end-to-end behavior.

Use separate states for context drafting, user approval, implementation, and verification. Status must reflect work actually performed and verified in resume-forge.

## End of session

Update [progress-tracker.md](progress-tracker.md) with changed files/slices, checks run, unresolved decisions, and one concrete next step. Keep the root [project-tracker.md](../project-tracker.md) as a link rather than duplicating progress. Do not store credentials or personal data in session notes.

## Current frontend requirement

The 2026-09-29 request selects Performative UI, requests section-context resume prompts, and originally paused concepts; later requests approved Forge Studio. Read [frontend integration](frontend-integration.md) and [editing contract](resume-editing-contract.md) before F01/F06/F08 work. These are approved direction inputs; implement only the authorized slice. Distinguish directly observed reference behavior from public advertising and inaccessible editor behavior. Do not add reference-platform features outside resume scope or treat new documentation as approval of open decisions.

The later U06 [capability register](resume-capability-coverage.md) records comprehensive observed resume scope. F19/F20 and Phase 6 are proposed allocations. Review them explicitly before dependent implementation; do not interpret a complete matrix as tested parity, approved technical decisions or authorization to start development.
