> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# F19 — Existing Resume File Import

## Audited status — 2026-10-11

**Partially done.**

- [x] ✅ Local bounded PDF.js/Mammoth/TXT/MD workers, two-column parsing corrections, library upload modal, editable staging, explicit idempotent Confirm and save, private source-text persistence without master/contact writes. Raw text UI is reversibly disabled. [Source](../../../../../services/resume-service/src/upload.ts).

**Remaining:** OCR/legacy DOC, arbitrary-layout coverage, field confidence/provenance, private upload staging/expiry, source retention/purge and shared contact separation remain missing. Reviewed imports are bounded, not universal extraction.

This snapshot supersedes dated implementation/pending statements below. Full acceptance stays unchecked where integration or verification is missing. [Complete audit](../../docs/implementation-audit.md).

## Library modal intake — 2026-10-10

Upload selection, bounded parsing/error recovery and editable review now happen in a dialog over My resumes. Legacy upload URLs share the same component. Nested field editing retains review; discarding does not create a resume. Explicit Confirm and save uses the existing idempotent owned create/version API and navigates to the saved editor. Original parser formats/limits and privacy policy remain unchanged. [Actual checks and manual guide](../../../readme-history.md#upload-dialog-ai-actions-and-template-gallery--2026-10-10). Full F19 provenance/OCR/shared-scope acceptance remains pending.

## Alternate two-column layout fix — 2026-10-09

The supplied final CV exposed row-by-row cross-column interleaving, missed Personal Profile, company-first role metadata and unspaced PDF bullet markers. The local PDF worker now separates independent narrative columns only when a persistent empty gutter and sufficient long text on both sides support that interpretation; right-aligned dates remain in the original row. The parser additionally preserves numeric months, date/location metadata, inline CGPA, standalone skill categories/parenthesized qualifiers, and separate language/proficiency fields.

The private file's six sections, three jobs, two projects, one education, 14 work/project bullets, 12 skills, four language pairs and both links survive parsing and the strict editor save-envelope round-trip. The older single-column sample still parses. Synthetic regressions cover the layout; no real file is committed or sent to a provider. Fresh uploads use the fix; confirmed existing versions are not overwritten. Local reviewed intake remains bounded by D14. Font emphasis/layout/rating dots, arbitrary columns, OCR and full provenance remain pending. [Evidence, Chrome automation limitation and manual steps](../../../readme-history.md#alternate-layout-import-and-no-jd-rule-cards--2026-10-09).


## Bounded personal intake — 2026-10-04

The latest user request authorizes a local personal slice before full Phase 6. Accept text PDF, DOCX, TXT/MD up to 10 MB, 30 PDF pages, 2,000 DOCX entries/20 MB declared expansion and 500,000 extracted characters. PDF.js/Mammoth run in a bounded local worker (8 seconds, two concurrent workers); no external provider, macro, HTML render or network resource execution. Authenticate and recheck access after parsing. Reject scanned/encrypted/corrupt/unsafe/unsupported files with recovery.

Extracted fields and source text form an editable unpersisted review. Explicit Confirm and save creates a private owned resume/immutable version/audit atomically; parse/cancel creates none. Original bytes are discarded. Confirmed text and structured content remain private local database version data. No master professional or UserContact update occurs; an empty FK anchor can be created when absent. Contact-bearing data is restricted to its authenticated personal owner; no shared/AI/export path is activated. This narrow boundary does not complete shared contact separation or D12 variants.

D14 is resolved only for these bounded local choices. Field-level provenance/confidence, private R2 staging, full retention/deletion controls, master merge, OCR and legacy DOC remain pending. Existing proposed routes/permissions below describe that wider future design. [Actual checks and manual steps](../../../readme-history.md#resume-library-upload-and-database-saves--2026-10-04).

**Mapping correction — 2026-10-08:** Bounded PDF extraction reconstructs visual rows/columns and adjacent glyphs; passive HTTP/HTTPS annotation destinations are included without network access. Plural headings, wrapped achievement text and entry/date/type/location/degree/project/technology metadata are preserved by the deterministic parser. Header links and actual imported language values survive the strict editor adapter/versioned saves. Fresh uploads use the fix; existing edited drafts are never silently reparsed. Real-sample upload/save/reload and synthetic regression results are recorded in [README](../../../readme-history.md#uploaded-resume-field-correction--2026-10-08). Review remains mandatory; this does not establish arbitrary-layout coverage or complete F19.

**Phase:** 6 — Resume Builder Expansion (proposed allocation) · **Priority:** High · **Implementation:** Partially done (audited 2026-10-11)

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

Resume MFE import/review flow; resume-service import use cases and typed DTOs; isolated parser task and private R2 staging. `resume-core` accepts normalized contact-free data only. See [API reference](../../../../api-reference.md) and [data model](../../../../../context/data-model.md). Import uses existing resume.create/template.view/profile.read; conservatively require profile.contact.read and profile.contact.update for the target identity for all intake until safe server-side separation is proven. Actors without those rights cannot upload contact-bearing files into a shared scope; server enforcement must not rely on user declarations.

## Acceptance and verification

- [ ] D14 formats, quotas, parser/provider disclosure and retention are resolved and documented.
- [ ] Supported synthetic files round-trip into reviewable sections; malformed, scanned, encrypted, oversized and decompression-bomb inputs fail safely.
- [ ] Contact values do not leak into professional fields, task DTOs, routine logs, unauthorized previews or suggestions; uncertain separation restricts the entire result.
- [ ] Confirm creates one new resume despite retries; cancel/failure/revocation cannot publish a result.
- [ ] User corrections and provenance survive editing/export; no master-profile/contact write occurs.
- [ ] Expired/deleted uploads and orphaned artifacts are cleaned up; raw sources are never publicly accessible.

The bounded personal intake above is available. The broader proposed acceptance list remains incomplete; it is not part of the original Phase 1 scaffolding.
