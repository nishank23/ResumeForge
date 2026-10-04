# F04 — Individual Profile Wizard

**Phase:** 1 — Foundation · **Priority:** Critical · **Implementation:** In progress — professional draft and Experience list/add/update APIs verified; browser wizard pending

## Goal and dependencies

Let an authenticated individual create and review their master professional profile. Requires F01–F03 and the approved ownership/contact contracts. Read [UI context](../ui-context.md) and [data model](../data-model.md).

## Ownership and planned files

`apps/profile-mfe/src/onboarding/`, `services/profile-service/src/`, shared profile/contact schemas, and profile-owned persistence. Shell owns the entry redirect; auth onboarding status is synchronized idempotently with profile completion.

## Flow and data

Proposed sequence: identity/contact → experience → education → skills → optional projects/certifications → review. Full name is required; allow entry-level users without experience. Define bounded text/list lengths and date rules in schemas before UI implementation; optional metrics/GPA/links must not be invented.

Save partial drafts through the proposed draft API with an expected revision. Section-level validation supports back/next navigation without discarding already-saved work. Final setup validates a usable profile, writes the profile-domain transaction, then updates onboarding state reliably. Repeated completion is idempotent.

Contact values use a separate request schema and permission path; professional summary updates cannot mass-assign contact, ownership, embeddings, roles, or workspace fields. Do not persist sensitive drafts in browser localStorage by default.

Selected bounded backend contract — 2026-10-04: PUT `/profile/draft` patches at least one of `fullName`, nullable `location` and nullable `professionalSummary` on an explicitly initialized, incomplete owned master. Require `expectedRevision`; missing fields stay unchanged, explicit null clears only nullable fields, and unknown/contact/authority fields are rejected. It shares the master's revision with normal PUT and returns the same contact-free DTO. GET `/profile` reloads the draft. Completed onboarding rejects draft saves with 409 `onboarding_complete`; saving never completes or reopens setup. Content-free `profile.updated` capture with `profile.update` / `draft_saved` commits atomically. This slice does not add section/contact persistence, final validation or the browser wizard.

## States

Selected Work Experience prerequisite — 2026-10-04: bounded owned list/add with shared parent revision, append order, year/month precision, strict plain-bullet limits and content-free audit. Missing master returns 404; no contact/ownership/keywords/metrics/completion mass assignment. This normal professional section operation also preserves completed onboarding. Read uses a parent share lock so entries/revision cannot disagree during concurrent application writes. [Experience API contract](../../docs/experience-api.md) defines limits/retry behavior; entry deletion/reorder and browser integration are separate slices.

Verified selected slice: PUT an existing owned Work Experience UUID with all seven allowlisted professional fields plus `expectedRevision`. Reuse the established date/bullet bounds; preserve ID/order, unrelated entries, hidden metadata and completion. With a current revision missing/foreign targets share a 404; stale revisions return 409 before child lookup, and parent/child/audit commit atomically. No contact or canvas persistence is implied; the [selected update contract](../../docs/experience-api.md#selected-owned-entry-update-slice--2026-10-04) governs this bounded implementation.

Show initial loading, unsaved/saving/saved, validation errors, server/network failure, conflict from another tab, session expiry, and successful review. Preserve recoverable input on failures without claiming an unsaved draft was stored.

## Acceptance and verification

- [x] Bounded professional draft prerequisite: strict partial owned-field save, omission/null semantics, shared revision conflicts, GET reload, completion-race rejection and transactional audit rollback verified (2026-10-04). This does not satisfy the full wizard criteria below.
- [x] Bounded Work Experience list/add prerequisite: explicit owned entries, year/month/null semantics, plain-bullet bounds, parent revision/snapshot consistency, capacity, contact/authority rejection and atomic audit rollback/retry verified (2026-10-04). Entry deletion/reorder and browser wizard remain pending.
- [x] Bounded Work Experience update prerequisite: full-field owned-entry replacement/clear, stable ID/order/metadata preservation, shared conflicts, missing/foreign target rejection, blocked-write expiry and audit rollback/retry verified (2026-10-04). Canvas persistence and the full wizard remain pending.
- [ ] New and returning users can start/resume a server-saved draft and finish onboarding.
- [ ] Users with empty optional sections can complete a valid profile.
- [ ] Repeated setup does not duplicate profile rows or section entries.
- [ ] Editing another profile ID/workspace selector is rejected for individual users.
- [ ] Contact stays separate in persistence/DTOs; forbidden mass-assignment fields are rejected.
- [ ] Invalid dates, long inputs, network failure, concurrent edits, and accessible step navigation are verified.

AI resume creation is F06; editing a completed profile is F12; archive import is F16.

2026-10-04 backend prerequisite: private professional POST/GET/PUT and draft PUT support explicit owned initialization, full update and partial incomplete-onboarding saves with revisions and atomic audit capture. POST requires a user-supplied full name, defaults omitted location/summary to null and leaves onboarding incomplete. Repeated/concurrent creation returns `profile_exists` without overwriting; GET recovers an uncertain response and reloads drafts. Work Experience GET/POST and entry PUT now list/add/update owned facts with this same parent revision. The selected narrow contracts are verified; no entry deletion/reorder, other section/contact API, browser wizard or completion endpoint is implemented. F04 remains partial; [profile API verification](../../docs/profile-api.md) and [Experience verification](../../docs/experience-api.md#verify-locally) record actual checks and limits.

## Profile-first builder handoff — 2026-09-29 planning update

Use the selected shared UI styling and purposeful step motion. Completing the wizard offers a future handoff to basic resume creation or JD tailoring; it does not call AI or fabricate profile facts. Resume-section prompts are F06/F08, not implicit AI writing into onboarding fields.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Wizard completion preserves separate contacts and passes only authorized profile identity/revision to the resume flow.
