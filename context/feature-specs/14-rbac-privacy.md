# F14 — Workspace RBAC and Field Privacy

**Phase:** 4 — Multi-Tenant · **Priority:** High · **Implementation:** Not started

## Goal and dependencies

Apply one consistent authorization policy across all workspace entrypoints and outputs. Personal ownership checks already exist from Phase 1. Requires F13's authoritative membership context, approved D03/D05/D12 policies, and the canonical [27 permissions](../authorization-model.md).

## Ownership and planned files

`packages/authorization/src/permissions.ts`, `roles.ts`, `can.ts`, `middleware.ts`, `privacy.ts`; domain service policies/serializers; query cache boundaries; export/task/MCP adapter integration. `can()` consumes verified policy context rather than trusting a role string from a request body.

## Build scope

1. Encode approved role grants, workspace-type validation, resource ownership/grants, feature availability, and delegation constraints with deny-by-default behavior.
2. Apply policy to every read/mutation/list/internal-call/task-token route, not just page guards.
3. Build allowlisted DTO serializers with independent contact permissions; validate both input fields and output projection.
4. Propagate current privacy rules to resume content, historical versions, previews, PDF variants, job outputs, errors, and member lists.
5. Invalidate cached capabilities/data after role, workspace, session, or grant changes; recheck long-running work and artifact retrieval.

## Privacy edge cases

Vendor editors/viewers must never obtain private contact values. The draft also denies other vendor roles until D05 decides. A saved resume/PDF created by a more privileged actor must not bypass a later reader's restrictions. Detect known contact copied into free text and restrict unsafe content when reliable projection is impossible; do not assume removing a single `contact` object solves every leak.

## Acceptance and verification

- [ ] Exactly the 27 canonical permission names are defined; unimplemented/reserved capabilities remain inactive; F20 template.manage activation requires its own verified release.
- [ ] Every approved role/action/workspace combination has an explicit allow/deny test.
- [ ] Cross-tenant and cross-profile IDs fail on all entrypoints, including task tokens and signed downloads.
- [ ] Contact is absent from restricted DTOs, historical versions, UI caches, PDF text/metadata, task status, and MCP outputs.
- [ ] Suspended/revoked users lose access; client-provided roles/workspace IDs cannot elevate privileges.
- [ ] Owner delegation, mass assignment, and concurrent role-change scenarios are tested.

This feature does not add a configurable policy designer or invent permission names outside the agreed catalog.

## Suggestion and diff privacy — 2026-09-29 planning update

Enforce the existing permissions for suggestion create/read/apply/discard from the editing contract. Include prompts, fact inputs, proposed replacements, reasons, comparison views and historical apply metadata in privacy projection. No new permission identifier or implicit contact/profile-write grant is introduced.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Restricted roles cannot recover contacts through suggestion text, diff payloads, task subscriptions or late responses.
