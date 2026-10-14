> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Phase 3 Build Plan — Complete Individual Flow

## Audited phase status — 2026-10-11

**Partial individual flow.**

- [x] ✅ Owned library/search of loaded rows/sort/pagination, rename/delete/undo, current owner PDF and basic profile form work. JD history backend exists.
- [ ] R2/storage lifecycle, global search, clone/default/history/restore UI, optional profile sections and full release acceptance remain.

The [audit](../../docs/implementation-audit.md) gives exact feature/module evidence. Original task IDs and exit gates below remain the broader release plan; dated checkpoints do not override current status.

**Features:** F09–F12. **State:** Not started. **Goal:** Manage, revise, revisit, and download saved work.

## Entry conditions

Phase 2's versioned generation/preview works. D10/D12 define the PDF runtime, artifact privacy, and link expiry; D11 defines applicable retention/deletion. Personal authorization continues to apply to every new endpoint.

## Task P3.1 — Storage and export (F09)

Planned files: storage-service R2 adapter, `trigger/generate-pdf.ts`, artifact metadata and resume-service export/download routes.

- [ ] Implement [F09](../feature-specs/09-pdf-export.md) version/variant rendering and idempotent private upload.
- [ ] Verify short-lived scoped download access and separate content/PDF readiness.
- [ ] Test renderer/upload/persistence failure, deletion races, and cleanup.
- [ ] Visually inspect PDF pages and extract text/metadata for exact-version and contact-privacy checks.

## Task P3.2 — Dashboard and version access (F10)

Planned files: resume-MFE dashboard/query hooks; resume-service list/version/delete contracts.

- [ ] Implement [F10](../feature-specs/10-resume-dashboard.md) pagination, statuses, open/download/retry/delete actions, and empty/error states.
- [ ] Confirm historical-version access and domain-safe deletion across artifacts/jobs.
- [ ] Verify list scope, stale request isolation, role-hidden actions, and mobile/keyboard behavior.

## Task P3.3 — JD history (F11)

Planned files: history UI and resume-service list/detail/reuse paths.

- [ ] Implement [F11](../feature-specs/11-jd-history.md) source/parsed detail and reuse without overwriting historical input.
- [ ] Verify missing title/company, denied linked resources, pagination, and safe text rendering.

## Task P3.4 — Profile editor (F12)

Planned files: profile editor and shared wizard controls; scoped section/contact updates; revision/embedding invalidation.

- [ ] Implement [F12](../feature-specs/12-profile-editor.md), including save states and conflicts.
- [x] ✅ Master professional writes do not mutate immutable resume versions. Full regeneration/history UI remains unbuilt. [Profile source](../../../../../services/profile-service/src/profile.ts).
- [ ] Verify field-level input permissions, section deletion/reorder, and concurrent tabs.

## Task P3.5 — Individual release review

- [ ] Exercise sign-in → profile → JD → generation → preview/edit → export → return through dashboard/history.
- [ ] Verify an unauthorized second user cannot access any resource or task/artifact handle from that flow.
- [ ] Record operational/deployment checks from [deployment.md](../../../../deployment.md) before any public release.

## Exit gate

F09–F12 acceptance criteria pass with PDF visual/text evidence, version integrity, and retry/deletion checks. The individual flow is complete; shared organization/vendor features remain behind Phase 4's gates. Cover letters and additional template packs stay deferred.

## Contextual editor integration gate

- [ ] Wire dashboard intent/create/continue actions to F06/F08 using shared PromptHero; do not imply unimplemented upload or template packs.
- [ ] Let JD history supply explicit authorized context for the next suggestion without overwriting history.
- [ ] Exercise Apply → new version → stale score/PDF → recompute/export → reopen/restore; each output must match its version.
- [ ] Verify missing-fact handoff to F12 is explicit and never changes a master profile via the assistant.

Follow [editing contract](../resume-editing-contract.md). File intake is F19 in proposed Phase 6; D14 gates its technical details.

## U06 coverage additions

- [ ] F10 implements scoped title/role/company search, stable sorting/pagination, rename, independent clone and actor/workspace active-resume preference.
- [ ] Verify clone/retry/privacy isolation, stale-score sorting and preference invalidation on deletion/access loss.
- [ ] F11 shows optimization events with JD/version provenance, details and explicit restore-as-new; no history overwrite.
