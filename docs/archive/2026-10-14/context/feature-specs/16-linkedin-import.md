> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# F16 — LinkedIn Data Import

## Audited status — 2026-10-11

**Not started.**

- [ ] No archive import/review/merge implementation. The unused OAuth provider helper is not archive import.

**Remaining:** Archive format/limits, safe unpacking, provenance/conflict review, permissioned atomic master merge and temporary-artifact cleanup all need building.

This snapshot supersedes dated implementation/pending statements below. Full acceptance stays unchecked where integration or verification is missing. [Complete audit](../../docs/implementation-audit.md).

**Phase:** 5 — Advanced · **Priority:** Medium · **Implementation:** Not started (audited 2026-10-11)

## Goal and dependencies

Let a user review and merge data from their own LinkedIn export into their profile. Requires F12 editing/revisions, F14 privacy, F15 auditing, and approved upload/retention limits. OAuth login alone is not the import mechanism.

## Ownership and planned files

Profile-service import parsing/mapping/review endpoints, profile-MFE import review UI, shared import schemas, storage-service temporary upload support, and a durable parsing task where needed.

## Build scope

1. Verify supported archive/file formats against current official export documentation and representative user-authorized fixtures before promising field coverage.
2. Define bounded upload size, unpacked size, entry count, allowed types/paths, and retention/cleanup behavior.
3. Parse on the server without executing file content or fetching arbitrary links; handle archive traversal, compression bombs, malformed encodings, and unexpected columns safely.
4. Map supported professional/contact fields into a preview with source provenance, warnings, duplicates, and conflicts.
5. Require an explicit selection/confirmation before merging. Apply each field's permission and expected profile revision; import is not a contact-write bypass.
6. Commit selected changes atomically within the profile domain, invalidate derived embeddings, audit the action, and clean temporary artifacts under policy.

## States and constraints

Show unsupported format, partial mapping, duplicate entry, conflicting revision, parse failure, expired upload, permission denial, and merge success. Do not silently overwrite existing profile sections or convert absent data into invented facts. A vendor's membership does not authorize importing a person's data without the approved consent policy.

## Acceptance and verification

- [ ] Supported fixtures produce a comprehensible preview before any master-profile mutation.
- [ ] Confirmed selected fields merge correctly; cancellation changes nothing.
- [ ] Contact updates, ownership, and cross-tenant upload/import IDs are independently authorized.
- [ ] Malformed/hostile archives and oversized input are rejected safely.
- [ ] Duplicate confirmation and concurrent profile edits do not duplicate or overwrite data silently.
- [ ] Temporary files expire/clean up and sensitive content is absent from logs.

No LinkedIn scraping, browser credential capture, automatic profile synchronization, or assumed private API access is included.

## Import remains a reviewed factual source — 2026-09-29 planning update

Keep this feature limited to reviewed LinkedIn archives. Confirmed facts may support later resume suggestions only through a fresh explicit request and revision snapshot. The reference platform’s PDF/DOC intake is D14 and does not expand this parser implicitly.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Import confirmation cannot auto-apply a pending resume suggestion, and unsupported resume-file types are not advertised as accepted.
