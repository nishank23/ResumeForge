# F10 — Resume Dashboard

## Personal library slice — 2026-10-04

Implemented actual owned list/create/open, title editing through editor Save changes, bounded 50-row pages, Load more, search/sort of loaded rows and honest saved-version/update metadata. Empty/loading/error/retry/no-match states replace sample rows. Dark/light desktop and 390px layout were checked. No readiness score, PDF action, clone/delete, version restoration or active/default selection is implied. Concurrent list mutation does not have snapshot pagination guarantees. Full F10 acceptance remains partial. [User checks](../../README.md#resume-library-upload-and-database-saves--2026-10-04).

**Phase:** 3 — Complete Individual Flow · **Priority:** High · **Implementation:** Partial — bounded personal slice above implemented; full acceptance pending

## Goal and dependencies

Make saved resumes easy to find, open, and manage within the active workspace. Requires F06 persisted versions, F08 preview, and F09 downloads. Read [API contracts](../../docs/api-reference.md) for list/resource routes.

## Ownership and planned files

`apps/resume-mfe/src/dashboard/`, scoped query hooks, resume-service list/delete/version use cases, and shell workspace routing. Backend summaries contain only authorized fields needed for the list.

## Build scope

Show title/JD role/company when present, update time, generation state, current version, available ATS score, and PDF readiness. Use bounded cursor pagination and stable ordering. Default to an empty state with “Create resume”; do not present mock resumes as persisted work.

Actions: open, create from a JD, inspect available versions, download a ready permitted PDF, retry a failed permitted generation, and confirm deletion. Derive action visibility from server capabilities, with full server enforcement. U06 adds search/sort, rename, clone and active/default selection below. Bulk operations remain separate scope.

Deletion removes access immediately and initiates idempotent artifact cleanup; in-progress workers must not recreate deleted accessible content. Selecting an older version does not overwrite the current one without an explicit save operation.

## States

Handle initial loading, no resumes, page loading/error, stale session, access lost, task still running, failed generation, artifact pending, and deletion failure. Scope cache keys to actor/workspace; discard stale in-flight results on switches.

## Acceptance and verification

- [ ] Refresh preserves saved resumes and their true current state.
- [ ] Pagination has stable results without cross-workspace leakage or obvious duplicate pages.
- [ ] Open/version/download actions refer to the intended resume and exact version.
- [ ] Deleted items lose access and do not reappear through a worker race.
- [ ] Denied roles cannot trigger hidden actions by calling endpoints directly.
- [ ] Empty/error/mobile/keyboard flows and a workspace-switch-during-request scenario are verified.

No candidate list, hiring funnel, or recruiting dashboard is included.

## Resume-focused entry and continuation — 2026-09-29 planning update

Use the wrapped PromptHero as an optional intent entry alongside explicit Create from profile and Tailor to JD actions. Resume rows/cards reopen the correct editor/version and show real score/PDF freshness. Use our own design and labels; no competitor hiring verdicts, fabricated sample work or job-board/community navigation. Expose file upload only with verified F19 in proposed Phase 6, after D14 is resolved.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] A create/continue action resolves the correct profile/resume/workspace, and pending/stale suggestions never auto-apply on reopening.

## Complete saved-resume management — U06

Search authorized titles/JD role/company with bounded input and stable cursor pagination; sort by title, updated time or current available ATS score with deterministic ID tie-breakers. Absent/stale scores remain labeled and cannot be compared as current. Changing query/sort resets pagination. Renaming changes metadata with expected-revision checks, not content history.

Clone an authorized version into a new independently editable resume in the same workspace, preserving permitted content, template/settings and provenance. Allocate fresh identity and initial version; do not copy task state, suggestions, downloadable URLs or treat old score/PDF as current. Recheck contacts under current policy. Never clone into another workspace implicitly.

Active/default resume is a per-actor, per-workspace preference. Setting it requires resume.read; it grants no access and sends/applies nothing. Deletion or access loss clears/invalidates the preference; never silently substitutes a different person's resume. It is distinct from a resume's current version.

- [ ] Search/sort/pagination never disclose inaccessible titles or mix scopes, and reset appropriately when inputs change.
- [ ] Rename/clone retries and concurrent saves do not corrupt versions; a clone can be edited without changing its source.
- [ ] Active selection is isolated by actor/workspace and invalidated by deletion/revocation.
