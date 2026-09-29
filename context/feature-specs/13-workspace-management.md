# F13 — Organization and Vendor Workspaces

**Phase:** 4 — Multi-Tenant · **Priority:** High · **Implementation:** Not started

## Goal and dependencies

Add organization/vendor collaboration to the existing personal workspace foundation. Requires the complete individual flow, D02 consent, D03 sharing/copy semantics, D04 workspace identity, and invitation delivery configuration. Develop against F14/F15 contracts together; do not expose shared-workspace access before their verification passes.

## Ownership and planned files

`services/workspace-service/src/`, shell workspace selector/settings/member screens, shared workspace/membership DTOs, and workspace-owned models. The profile service retains professional/contact ownership.

## Build scope

1. Implement create/list/details for the approved workspace model; creator becomes owner without granting access to other users' profiles.
2. Implement the approved invite/accept/revoke/resend lifecycle. Invitation tokens are bounded, identity-bound, stored safely, and useless after expiry/revocation. Invite delivery is an integration decision, not a live message authorized by this planning task.
3. Manage role/status changes and removal with delegation restrictions and last-owner protection.
4. Implement a workspace switch that resolves active membership/capabilities and clears stale UI/query state.
5. Connect profile access only through the approved D03 grant/copy model. Define revocation effects on profile reads, existing resume snapshots, queued jobs, and downloads.

## Rules and states

Source membership states are invited/active/suspended; define removal history in the approved schema. Workspace membership and permission to a target profile remain distinct. Switching changes context, not resource ownership. Prevent an admin from granting protected roles or removing the final active owner through concurrent requests.

Show invitation pending/expired, already-member, suspended/revoked, empty workspace, unavailable target profile, and delivery failure states. Member lists must not reveal protected contact/auth identity fields.

## Acceptance and verification

- [ ] A user can belong to and switch between multiple workspaces without cached data leakage.
- [ ] Only the approved consent flow grants vendor/profile access; replayed invitations fail safely.
- [ ] Role changes/removals preserve owner constraints and immediately affect new authorization checks.
- [ ] Grants/copies and revocation behave exactly as D03 specifies across services and artifacts.
- [ ] Concurrency, cross-workspace member IDs, invitation replay, and switched in-flight requests are tested.
- [ ] F14 privacy and F15 audit evidence are complete before enabling shared access.

Seat billing, global user administration, and recruitment workflows are excluded.

## Workspace-bound editor state — 2026-09-29 planning update

Bind selection, instruction drafts, suggestions and task subscriptions to the active actor/workspace/resume. Switching clears private transient state and reauthorizes persisted resources. A pending suggestion retains its original scope and cannot be applied to the newly selected workspace.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Switch/revoke/suspend during suggestion generation or Apply produces no cross-workspace display or mutation.
