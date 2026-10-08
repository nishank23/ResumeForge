# F12 — Master Profile Editor

**Current integration — 2026-10-04:** The latest user request removes required Create profile onboarding and replaces the sample resume with an owned library/upload/review/version-save flow. Work runs in the named frontend worktree; port 4003 now belongs to the restricted personal resume service. Dialog Save changes the working draft; editor Save changes persists a version. Professional profile editing remains optional. Earlier sample/reset/profile-first or stopped-resume statements below are historical. [Current changes, startup and manual checks](../../README.md#resume-library-upload-and-database-saves--2026-10-04).

**Phase:** 3 — Complete Individual Flow · **Priority:** High · **Implementation:** Not started

## Goal and dependencies

Allow explicit maintenance of the master profile after onboarding. Requires F04 section contracts and F03 revision/ownership semantics. Reuse validation and field components from onboarding; do not create a second incompatible profile format.

## Ownership and planned files

`apps/profile-mfe/src/editor/`, profile-service section/contact endpoints, shared profile schemas, and revision/embedding invalidation logic.

## Build scope

Support reading and editing professional summary, education, experience, skills, projects, and certifications; add/remove/reorder repeatable sections. Contact editing is a separately permissioned surface and request. Clearly label this as the master profile; users editing a resume should not accidentally modify the source profile.

Use expected-revision saves and understandable save/conflict states. Update revision and derived-content hashes on successful professional changes; schedule idempotent embedding regeneration when applicable. Never synchronously wait for AI to accept a factual edit.

Existing resumes remain immutable snapshots of their original inputs. Show when an existing resume is based on an older profile revision; regenerating is an explicit separate action. Restrict sensitive field updates even when a broad professional section update is allowed.

## States

Loading, unsaved changes, save pending/success/failure, conflict, missing optional sections, invalid date ranges, and lost access need reviewable behavior. Destructive section removal uses a clear confirmation/undo approach appropriate to persistence and does not cascade into historical resumes.

## Acceptance and verification

- [ ] Users can add/edit/reorder/remove their authorized sections and reload saved values.
- [ ] Contact reads/writes require dedicated permission and cannot be mass-assigned through another endpoint.
- [ ] A successful edit increments revision, invalidates derived embeddings, and leaves prior resume versions unchanged.
- [ ] Concurrent tabs receive a conflict/reload path instead of silent last-write loss.
- [ ] Validation, session expiry, failed saves, keyboard access, and cross-profile ID attacks are covered.

Automatic AI profile rewriting and LinkedIn archive merge are excluded; explicit reviewed import is F16.

## Resume and master edit separation — 2026-09-29 planning update

A missing factual claim in a resume suggestion may link to the explicit master-profile editor. The user supplies and saves facts under profile permissions, then explicitly requests a fresh resume suggestion. PromptHero/Prompt styling does not authorize automatic master-profile rewriting or contact access.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Adding facts updates profile revision only; existing resumes and proposals are not silently merged or rewritten.

## Professional browser integration — 2026-10-04

The frontend now explicitly creates/loads/saves professional full name, nullable location and nullable summary using existing personal APIs and the shared session. Incomplete setup uses changed-field revisioned drafts; completed accounts use full updates. Failed input remains mounted, stale saves require explicit reload, and save does not mark onboarding complete. The shell's onboarding entry uses this same form. Contacts and section/completion UI are pending. [README](../../README.md#personal-profile-integration-and-sign-in-repair--2026-10-04) records actual tests, runtime repair and manual checks. This is a bounded partial slice, not full F04/F12 acceptance.
