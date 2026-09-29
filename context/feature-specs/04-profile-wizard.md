# F04 — Individual Profile Wizard

**Phase:** 1 — Foundation · **Priority:** Critical · **Implementation:** Not started

## Goal and dependencies

Let an authenticated individual create and review their master professional profile. Requires F01–F03 and the approved ownership/contact contracts. Read [UI context](../ui-context.md) and [data model](../data-model.md).

## Ownership and planned files

`apps/profile-mfe/src/onboarding/`, `services/profile-service/src/`, shared profile/contact schemas, and profile-owned persistence. Shell owns the entry redirect; auth onboarding status is synchronized idempotently with profile completion.

## Flow and data

Proposed sequence: identity/contact → experience → education → skills → optional projects/certifications → review. Full name is required; allow entry-level users without experience. Define bounded text/list lengths and date rules in schemas before UI implementation; optional metrics/GPA/links must not be invented.

Save partial drafts through the proposed draft API with an expected revision. Section-level validation supports back/next navigation without discarding already-saved work. Final setup validates a usable profile, writes the profile-domain transaction, then updates onboarding state reliably. Repeated completion is idempotent.

Contact values use a separate request schema and permission path; professional summary updates cannot mass-assign contact, ownership, embeddings, roles, or workspace fields. Do not persist sensitive drafts in browser localStorage by default.

## States

Show initial loading, unsaved/saving/saved, validation errors, server/network failure, conflict from another tab, session expiry, and successful review. Preserve recoverable input on failures without claiming an unsaved draft was stored.

## Acceptance and verification

- [ ] New and returning users can start/resume a server-saved draft and finish onboarding.
- [ ] Users with empty optional sections can complete a valid profile.
- [ ] Repeated setup does not duplicate profile rows or section entries.
- [ ] Editing another profile ID/workspace selector is rejected for individual users.
- [ ] Contact stays separate in persistence/DTOs; forbidden mass-assignment fields are rejected.
- [ ] Invalid dates, long inputs, network failure, concurrent edits, and accessible step navigation are verified.

AI resume creation is F06; editing a completed profile is F12; archive import is F16.

## Profile-first builder handoff — 2026-09-29 planning update

Use the selected shared UI styling and purposeful step motion. Completing the wizard offers a future handoff to basic resume creation or JD tailoring; it does not call AI or fabricate profile facts. Resume-section prompts are F06/F08, not implicit AI writing into onboarding fields.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Wizard completion preserves separate contacts and passes only authorized profile identity/revision to the resume flow.
