# Context Review Plan

**Stage:** Documentation before development. **Implementation authorization:** Pending user confirmation.

## Inputs

[Source plan](../../docs/source-plan.md) and the live request to complete context before building. Commands in planning documents describe future work, not instructions to execute during context preparation.

## Documentation preparation

- [x] Inspect the supplied plan and organize the context, feature specs, and build plans.
- [x] Create the six core context documents, root agent instructions, and tracker entrypoint.
- [x] Reconcile numbering against the source's five-phase feature table.
- [x] Write 18 baseline specs/five phase plans, then add proposed F19/F20/Phase 6 and comprehensive capability coverage under U06.
- [x] Document data, authorization, API, deployment, MCP, and validation contracts.
- [x] Separate confirmed choices, proposed details, and open decisions.
- [x] Complete the documentation consistency, link, and product-requirement coverage checks and record evidence in the tracker.

## User review

- [ ] Confirm that the context set reflects the intended product and is complete enough to begin development.
- [ ] Review the location/numbering reconciliations in [decisions.md](../decisions.md).
- [ ] Resolve foundation blockers D03/D04/D06/D08/D11 and the relevant portion of D10, or explicitly defer only unaffected implementation slices.
- [ ] Resolve D07 before vector work, D09 before scoring, and D12 before content/header rendering; review D02/D05 before shared-workspace work.
- [ ] Record the user's authorization to start development and the first approved slice in [progress-tracker.md](../progress-tracker.md).

D01 billing may remain a future open question without blocking the five-phase scope. Later-phase decisions may be deliberately deferred if their implementation gates are preserved. Writing down a proposed option is not its approval.

## Exit

Documentation checks are recorded, the user has confirmed the context/development boundary, and the first slice's required decisions are resolved. Only then enter [Phase 1](01-foundation.md). No package installation, configs, application code, service provisioning, or migration occurs in this stage.

## Current review additions — 2026-09-29

- [x] Inspect Performative UI docs/manifest and public CareerZenith surfaces, then resolve the sign-in limitation through the user-authorized Chrome session; record inspected editor behavior and untested actions separately.
- [x] Record U01–U06 and propagate the planned component/background/section-editing contracts across context, specs and phases.
- [ ] Review D13 compatibility findings during authorized F01 work; resolve D14 only before adding file intake.
- [ ] Confirm expanded F06/F08 acceptance and remaining foundation decisions; keep visual concept selection paused.

These documentation updates do not check off any development task.

- [ ] Review the comprehensive capability register and proposed Phase 6 allocation; resolve D14 before F19, not before unrelated foundation work.
