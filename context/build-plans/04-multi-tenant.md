# Phase 4 Build Plan — Multi-Tenant Workspaces

**Features:** F13–F15. **State:** Not started. **Goal:** Enable organizations/vendors with approved consent, isolation, privacy, and audit behavior.

## Entry conditions

The individual flow is verified. D02/D03/D04/D05/D11/D12 are resolved for shared operation, and invitation delivery/configuration is chosen under D10. Do not activate organization/vendor endpoints first and add their access controls afterward.

## Task P4.1 — Finalize shared-access contracts

Planned files: workspace/profile/grant/membership schemas, authorization mappings, audit schemas, shared API contracts.

- [ ] Turn reviewed consent, grant/copy, role delegation, contact, revocation, and retention decisions into concrete contracts.
- [ ] Review migrations and compatibility with existing individual profiles/resumes before applying them.
- [ ] Preserve the exact 27 permission identifiers and inactive reserved capabilities until their own verified release (including F20 shared presets).

## Task P4.2 — Membership service and UI (F13)

Planned files: workspace-service routes/use cases, shell selector/settings/member screens, scoped API/cache integration.

- [ ] Implement [F13](../feature-specs/13-workspace-management.md) create/list/switch and invite/accept/revoke/remove behavior against policy contracts.
- [ ] Enforce delegation and final-owner constraints in the server and database/concurrency boundary.
- [ ] Propagate role/grant changes to subsequent service calls, cache reads, and in-flight operations.

## Task P4.3 — Full RBAC/privacy (F14)

Planned files: authorization package; all service DTOs/middleware/use cases; job/export privacy paths.

- [ ] Implement [F14](../feature-specs/14-rbac-privacy.md) approved role grants and resource-aware policy.
- [ ] Apply contact restrictions to every historical/current response, document variant, task output, and member list.
- [ ] Run the full role/action matrix plus cross-workspace/cross-profile/revocation scenarios.
- [ ] Inspect contact-marker fixtures in JSON, DOM, PDF text/metadata, logs, and task outputs.

## Task P4.4 — Durable audit and viewer (F15)

Planned files: producer outbox/delivery adapters, workspace-service audit ingestion/query, shell audit screen.

- [ ] Complete [F15](../feature-specs/15-audit-logging.md) ingestion, deduplication, viewer scope, and approved retention/failure semantics.
- [ ] Verify sensitive actions already captured in earlier phases still produce attributable events.
- [ ] Simulate delivery outage and recovery; verify no committed mutation events are silently lost.

## Exit gate

Shared workspaces may be enabled only after F13–F15 acceptance evidence passes together. Review vendor contact restrictions and profile-consent revocation end to end, including pre-existing PDFs and queued tasks. No billing or recruitment workflow is activated by this phase.

## Shared contextual-editing release gate

- [ ] Extend every role/action/privacy fixture to suggestions, comparisons, Apply/Discard and task results with the existing 27 permissions.
- [ ] Verify workspace switch, changed grants and revoked membership during generation/review/Apply.
- [ ] Record suggestion lifecycle IDs/outcomes and applied-version linkage in audit without prompt or comparison bodies.

Shared editor access is gated with F13–F15, not granted by a visible prompt control. See [editing contract](../resume-editing-contract.md).
