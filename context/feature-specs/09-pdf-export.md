# F09 — PDF Export and R2 Storage

**Phase:** 3 — Complete Individual Flow · **Priority:** High · **Implementation:** Partial — personal saved-version stream implemented; durable R2/shared pipeline pending

## Goal and dependencies

Persist and download the exact authorized resume version as a private PDF. Requires F06/F08, storage-service contracts, and D10/D12's hosting, artifact visibility, and signed-link policy.

## Ownership and planned files

`trigger/generate-pdf.ts`, resume-service export/download use cases, storage-service R2 adapter, version/artifact metadata, and resume-MFE export controls. The proposed server renderer uses the same React PDF template as preview; verify font/runtime support before adopting this pipeline.

## Build scope

1. Authorize `resume.download`, version ownership/scope, and any contact access before selecting a render variant.
2. Snapshot content/template/header revisions and render a private contact-bearing or contact-free artifact as permitted.
3. Upload under a server-generated resource/version/variant key; verify checksum/content type and persist artifact identity idempotently.
4. Return a short-lived signed URL or authenticated stream after rechecking access. No public R2 bucket or permanent public links.
5. Make render/upload/database failures retryable without marking an incomplete artifact ready; clean orphaned objects safely.

## Lifecycle

PDF readiness is separate from resume-content completion. Edits/template changes invalidate current artifact applicability; historical versions can retain their own artifacts under retention policy. A restricted actor never receives the unrestricted artifact's key/URL, even if it already exists. Deletion prevents task resurrection and schedules cleanup; issued-capability expiry behavior must be documented honestly.

## Acceptance and verification

- [ ] Downloaded content corresponds to the requested version/template/privacy variant.
- [ ] Text extraction preserves expected resume text; no clipping, missing glyphs, blank overflow pages, or private metadata leaks.
- [ ] Cross-workspace IDs, arbitrary object keys, expired links, and unauthorized variants are denied.
- [ ] R2/render failure and repeated export converge safely without duplicate visible artifacts.
- [ ] Contact-free PDF text and metadata contain no protected header values.
- [ ] Visual review covers long experience lists, Unicode names, page breaks, and optional sections.

No DOCX export, public resume sharing, or unlimited retained artifact history is implicitly included.

## Export after contextual edits — 2026-09-29 planning update

An applied suggestion or manual save produces a new version requiring a matching export. Do not export unapplied proposals or silently reuse the previous version’s PDF as current. Prompt controls, selection highlights, motion and comparison markup never enter the document renderer.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Rendered PDF matches the explicitly selected saved version and privacy variant after Apply or restoration, with no assistant UI or leaked proposal metadata.

## U06 rendering continuity

F20 extends export identity with versioned render settings, font/renderer versions and template identity. Fit-to-page cannot hide or delete content; validate selectable text, order and clipping across every supported setting/template. F19 imported resumes use the same contact-safe render DTO after review, never direct export of the unrestricted original upload. Phase 3 still ships the initial template first.

## Requested editor export control — 2026-10-03

The user explicitly requests **Export PDF** in the compact Editor/Preview toolbar. The [frontend editor plan](../../docs/frontend-editor-plan.md) adds its pending acceptance criteria: explain unavailability before the real pipeline exists, identify the saved version, resolve unsaved changes explicitly, show preparing/ready/error/retry states, and preserve exact-version/privacy rendering. No fake download, browser-print substitute or export of unapplied proposals. Hidden sections, editor controls, ATS panels and placeholders never enter output. F09/D10/D12 dependencies remain open; this documentation does not implement export.

## Personal saved-version stream — 2026-10-08

The explicit owner-download request enables an authenticated PDF stream for the latest saved immutable editor version. Both library and editor use the same route; unsaved edits must be saved first. Server rendering checks personal workspace ownership, resume.download scope, version and expiry before and after rendering, with sanitized successful retrieval audit. Hidden content, source text, empty placeholders and app controls are excluded. A4 text pagination preserves supported facts; glyph errors fail visibly. Renderer and HTML preview are separate, so wrapping can differ. Local worker limits and font fallbacks are documented in the [README](../../README.md#delete-resumes-and-download-saved-pdfs--2026-10-08).

No PDF is stored, cached or published to R2. Export is owner-only and current-version-only; shared/contact-free variants, durable jobs, checksums/object identity, retained artifact history and purge remain unimplemented. Full F09 acceptance above stays open. D12 explicitly records this bounded personal export decision.
