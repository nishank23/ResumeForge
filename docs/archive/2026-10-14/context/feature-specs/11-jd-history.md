> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# F11 — JD History

## Audited status — 2026-10-11

**Partially done.**

- [x] ✅ JDHistory model plus parse/save/list/detail/delete use cases and route handlers; current JD input/result is retained in private assessment metadata. [Source](../../../../../services/resume-service/src/resume.ts).

**Remaining:** No connected JD history/reuse/timeline screen, history routes through gateway, authorized restore-as-new-version flow or durable provenance timeline. The sidebar route is a placeholder, not a working history feature.

This snapshot supersedes dated implementation/pending statements below. Full acceptance stays unchecked where integration or verification is missing. [Complete audit](../../docs/implementation-audit.md).

**Phase:** 3 — Complete Individual Flow · **Priority:** High · **Implementation:** Partially done (audited 2026-10-11)

## Goal and dependencies

Let users revisit the JDs they supplied and reuse them for another tailored resume. Requires F05 saved parsing, F06 generation, and F10 navigation. JD history remains resume input history, not a jobs catalog.

## Ownership and planned files

`apps/resume-mfe/src/jd-history/`, resume-service list/detail contracts, JDHistory persistence, and shared parsed-JD DTOs.

## Build scope

List scoped history by date with bounded pagination; show title/company when available and use a neutral fallback when the source did not specify them. Detail exposes the submitted JD, structured keywords/requirements/responsibilities, parse status, and linked resumes the actor may read.

“Use this JD” opens a new generation flow using the same authorized JD record and a currently accessible profile. It creates a separate resume/version intent rather than overwriting historical input. Re-parsing changed text creates a distinguishable revision/new record under the approved contract; previous resume provenance remains intact.

Avoid implicit fetches from external job URLs. Render user text safely, limit input/display size, and do not turn text links into automatic server fetches. Keep raw JD out of ordinary audit metadata.

## States and privacy

Empty history, missing title/company, parsing failure, denied/deleted profile access, and stale linked resume entries need explicit states. Apply workspace and profile scope to list, detail, reuse, and linked-resume queries independently; an ID from history is not a reusable grant.

## Acceptance and verification

- [ ] Submitted JDs persist and appear only in their authorized scope.
- [ ] Detail shows source-grounded parsed data without inventing missing fields.
- [ ] Reuse creates new tailored work while preserving the original JD/resume provenance.
- [ ] Pagination, oversized text, unsafe markup, and revoked access are tested.
- [ ] Cross-tenant detail/reuse attempts fail even when a JD ID is known.

JD deletion/retention follows D11; job discovery, applications, and employer publishing are outside this feature.

## JD reuse in contextual assistance — 2026-09-29 planning update

In addition to full-generation reuse, allow explicitly selecting an authorized saved JD as context for the open resume’s next suggestion. Display the target JD and preserve prior version provenance. No request is submitted merely by choosing a history entry.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Changing/reusing JD context cannot relabel old scores or redirect an already running section suggestion to the newly chosen JD.

## Optimization timeline — U06

Show generation, reviewed suggestion application, manual save and restore entries with exact resume/JD versions, timestamps and permitted change summaries. View Details uses current field policy. Restoring content creates a new version with expected revision checks and retains the old JD/provenance reference; require a fresh score/export for the resulting version. Do not revive discarded suggestions or deleted-resource access. Verify two-tab restore conflicts, restricted history fields and stale score/artifact labels.
