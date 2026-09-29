# F06 — Resume Generator, Suggestions and Durable Pipeline

**Phase:** 2 — AI Pipeline · **Priority:** Critical · **Implementation:** Not started

## Goal and dependencies

Create a profile-derived basic resume or generate a versioned, JD-tailored resume from supported master-profile facts; also produce reviewable section-specific suggestions. JD generation requires F05 and confirmed supporting facts; profile-copy needs accessible profile data, while blank mode needs only an authorized profile association. Task persistence and D12 govern AI/contact-safe content. F07/F08 integrate later in this phase; PDF persistence is F09.

## Ownership and planned files

`packages/resume-core/src/content-mapper.ts` and generation contracts, `packages/ai-provider/` prompts/schemas, `services/resume-service/src/`, `trigger/generate-resume.ts`, shared resume types, Resume/ResumeVersion/TaskRun persistence.

## Build scope

1. Authorize profile/JD/template and capture input revisions, actor/workspace, and a unique request identity.
2. Persist dispatch intent and reconcile Trigger.dev submission failures. Retried requests must converge on the same run/version intent.
3. Worker rechecks access, loads a contact-free immutable profile snapshot, selects relevant evidence, and requests structured tailored content.
4. Validate output structure and provenance. Reject unsupported employers, degrees, skills, dates, certifications, and metrics. Highlight an unsupported suggestion separately rather than inserting it into a resume.
5. Commit a ResumeVersion and current pointer transactionally; store model/prompt/schema/provenance metadata.
6. Integrate ATS scoring and template preview under their own contracts. Expose stage/status and safe error codes with an authorized run-token endpoint.

## Lifecycle and privacy

Content state uses generating/completed/failed; task stages explain progress. A failed attempt cannot replace the last good version. Profile changes during a run do not silently alter its input snapshot. A deleted resume or revoked access prevents stale workers publishing accessible output.

Master profile writes are never part of generation. Contact headers are composed separately under D12, and sensitive content never enters public task metadata. Apply bounded provider retries/timeouts and per-actor/workspace concurrency limits.

## Acceptance and verification

- [ ] One authorized request creates a persisted version with source/input metadata and an unchanged master profile.
- [ ] Duplicate delivery, dispatch failure, provider failure, and retry do not duplicate or corrupt current versions.
- [ ] Unsupported AI claims are rejected or isolated for review; input prompt injection cannot override this rule.
- [ ] Run token/status/output access is scoped to the current actor/workspace permissions.
- [ ] Revocation/deletion during execution and concurrent generation/save conflicts are tested.
- [ ] Successful generation integrates with F07/F08 before Phase 2 is marked complete.

Cover letters, batch recruitment processing, and automatic profile enrichment are excluded.

## Basic creation and scoped suggestions — 2026-09-29 planning update

Extend F06 with profile-derived basic draft creation without mandatory AI/JD, plus asynchronous section/item suggestion generation. A typed target limits the output; validate facts and contact-free provenance. Store a private proposal for review without changing the resume. F08 Apply reauthorizes and commits one new version with expected-revision/idempotency checks.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Unsupported facts, cross-target changes, duplicate requests/Apply, stale bases, discard races and revoked access preserve the last good version and unchanged master profile.

## U06 creation and fact sources

Accept explicit blank or profile-copy creation mode with authorized profile association, no mandatory JD and no automatic AI run. Suggestions can use user-confirmed manual/imported resume-local facts under the [editing contract](../resume-editing-contract.md), retaining origin/confirmation revision. Never treat prompt instructions, unreviewed parser output or previous AI prose as confirmed qualifications. F19 intake is later proposed Phase 6; no master-profile write is implied.
