# F19 — Existing Resume File Import

**Phase:** 6 — Resume Builder Expansion (proposed allocation) · **Priority:** High · **Implementation:** Not started

## Goal and dependencies

Let a user start an editable resume from an existing file, with extraction review before persistence. Requires F08/F09/F10 and shared F14/F15 policy; separate from F16 LinkedIn archive import. U06 requests this capability; D14 must resolve formats, parser, processing location, limits and retention before implementation. Proposed initial formats: text-based PDF and DOCX; legacy DOC and scanned-image OCR need explicit decisions, not assumed support.

## Proposed build scope — 2026-09-29 planning update

1. Explain supported formats/limits and whether a processor receives file content before upload. Accept only an authorized private upload reference bound to actor/workspace; never a public arbitrary URL.
2. Validate content signature, MIME, size, page/archive limits and encrypted/corrupt files. Parse in an isolated bounded worker; no macros, scripts, external resources or embedded instructions execute. Reject unsupported/scanned input with a clear recovery path.
3. Extract into a typed staging document with field-level provenance and uncertain/missing-field warnings. Separate contacts from professional content before preview or AI use. The importer must never invent missing dates, metrics or qualifications.
4. Review, correct and confirm extracted facts and section mapping. Extraction is untrusted until confirmed. Create a new resume and initial immutable version atomically and idempotently; do not replace a current resume or write UserProfile/UserContact.
5. Confirmed resume-local facts may ground suggestions on that resume, with import provenance, but cannot silently become master-profile facts. Master-profile updates remain a separate explicit F12 operation.
6. Allow cancel and recoverable parser failure. Apply configured staging/source retention and deletion cleanup. Recheck membership and input access when jobs run and results are read/confirmed.

## Ownership and contracts

Resume MFE import/review flow; resume-service import use cases and typed DTOs; isolated parser task and private R2 staging. `resume-core` accepts normalized contact-free data only. See [API reference](../../docs/api-reference.md) and [data model](../data-model.md). Import uses existing resume.create/template.view/profile.read; conservatively require profile.contact.read and profile.contact.update for the target identity for all intake until safe server-side separation is proven. Actors without those rights cannot upload contact-bearing files into a shared scope; server enforcement must not rely on user declarations.

## Acceptance and verification

- [ ] D14 formats, quotas, parser/provider disclosure and retention are resolved and documented.
- [ ] Supported synthetic files round-trip into reviewable sections; malformed, scanned, encrypted, oversized and decompression-bomb inputs fail safely.
- [ ] Contact values do not leak into professional fields, task DTOs, routine logs, unauthorized previews or suggestions; uncertain separation restricts the entire result.
- [ ] Confirm creates one new resume despite retries; cancel/failure/revocation cannot publish a result.
- [ ] User corrections and provenance survive editing/export; no master-profile/contact write occurs.
- [ ] Expired/deleted uploads and orphaned artifacts are cleaned up; raw sources are never publicly accessible.

No upload feature exists yet. This is additional planned work, not part of Phase 1 scaffolding.
