> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# F20 — Template Library and Formatting Customization

## Audited status — 2026-10-11

**Partially done.**

- [x] ✅ Classic/Modern/Editorial registry/gallery, strict appearance bounds, density/margins/fonts/colors, reset/undo/cancel and exact appearance snapshots in immutable saves and PDF rendering. [Source](../../../../../apps/resume-mfe/src/templates/registry.ts).

**Remaining:** Alternate layouts, durable template/font/renderer identity, personal/shared reusable presets, readable fit-to-one-page proposal and full browser/PDF parity remain missing. Three styles share one single-column layout.

This snapshot supersedes dated implementation/pending statements below. Full acceptance stays unchecked where integration or verification is missing. [Complete audit](../../docs/implementation-audit.md).

## Original style gallery — 2026-10-10

The latest user request authorizes two additional templates and extensible ownership. Classic, Modern and Editorial are original single-column formatting templates in the resume MFE's `templates/registry.ts`; the gallery consumes metadata/defaults automatically. Selection updates only allowlisted appearance, preserves content and joins existing undo/cancel/save/version behavior. Exact settings are persisted, rather than a live dependency on registry defaults, and the existing PDF renderer consumes them. Root modal portals correct layering behind the paper. [Scope, actual checks and manual guide](../../../readme-history.md#upload-dialog-ai-actions-and-template-gallery--2026-10-10).

This advances the earlier one-template preview slice but remains partial F20: alternate column/page layouts, durable template identity/version metadata, shared/personal presets, automated fit-to-page and comprehensive preview/PDF parity remain pending. Registry metadata identifies a preset definition; the saved document stores its exact appearance snapshot. No new permission or MFE deployment is added.

## Current bounded page presentation — 2026-10-08

Existing appearance now accompanies fixed A4 paper and view-only Fit page/Fit width/100%. Compact bounded defaults apply when saved appearance is absent; explicit settings remain authoritative. Overflow keeps all facts in an extended sheet and explains that it exceeds one A4 page. This is a presentation correction, not the proposed automated formatting-fit transaction, complete template gallery, full multi-page renderer or PDF parity. [Actual checks and manual steps](../../../readme-history.md#a4-resume-page-and-scroll-controls--2026-10-08). Earlier browser-only persistence wording is superseded by the owned version-save integration; full F20 remains partial.

## Explicit local preview slice — 2026-10-04

The user's new tool-panel request brings forward only browser-only preview controls: one original Forge Classic template preview, three density presets, bounded margins/spacing and four system-font typography roles, reset and whole-draft local history. This is partial presentation work under F08, not full Phase 6 implementation, a durable template inventory or preview/PDF parity. Readable local bounds and exact limitations are in the [local contract](../../docs/manual-editor-contract.md#editor-rail-and-local-formatting--2026-10-04); [verification](../../docs/editor-panels-verification.md) records actual evidence. Remaining acceptance criteria below are still unchecked.


**Phase:** 6 — Resume Builder Expansion (proposed allocation) · **Priority:** High · **Implementation:** Partially done (audited 2026-10-11)

## Goal and dependencies

Expand F08's initial template into an original template gallery and editable document appearance, using F09's same preview/export rendering contract. Depends on F08/F09/F10 and F14/F15; exact template count, categories and font licenses remain review choices. Reference controls establish capabilities, not assets to copy.

## Proposed build scope — 2026-09-29 planning update

- Gallery with original previews, categories including a student/early-career option, supported-section metadata and template ID/version. Select without losing content; warn before unsupported section/layout combinations. No competitor template artwork or institutional endorsement.
- Compact, balanced and spacious layout presets; independent margins, section gaps and item spacing within validated readable bounds.
- Section-header, heading, subheading and body typography: allowlisted licensed fonts, bounded sizes/line height and validated colors. Do not accept CSS, HTML, JavaScript, remote font URLs or executable template uploads.
- Editor preview/page count; changing appearance is an unsaved draft until explicit Save. Save template identity and render settings in a new version with expected-revision checks. Template defaults are versioned so historical PDFs remain reproducible.
- Fit to one page proposes only bounded formatting changes with a before/after preview. Never drop content or invent summaries. If a readable single page is impossible, explain and retain multiple pages. Content shortening is a separate user-requested F06/F08 suggestion.
- Reset previews the selected template's defaults; Save commits, Cancel restores the current saved appearance. Local undo/redo is available before Save.
- Save reusable personal appearance presets; shared workspace preset publication/update/archive requires template.manage and D05 grants. Presets contain validated settings only, never resume/contact content. Built-in templates remain read-only.

## Ownership and policy

Shared template/render DTOs and registry, browser/server renderer, resume MFE gallery/settings, resume-service version use cases and workspace-scoped preset storage. Use template.view plus resume.update for selection and per-resume formatting. Personal presets require own-scope resume.update; shared presets require template.manage. No new permission identifiers. The seven MCP tools remain unchanged; list-templates may list authorized new catalog entries when available.

Performative UI decorates app surfaces only. Resume pages and exports remain stable, opaque, readable documents without animation, glass effects or canvas backgrounds.

## Acceptance and verification

- [ ] Every supported template renders representative short/long synthetic resumes with selectable text, correct ordering and no clipped/hidden content.
- [ ] Browser preview and server PDF use identical version/template/settings; artifact cache identity changes with any rendering input.
- [ ] Formatting, switching, reset, local undo and saved restoration preserve facts, contact policy and old versions.
- [ ] Fit-to-page respects approved minimum typography/spacing; impossible requests fail visibly rather than hiding text.
- [ ] Keyboard/mobile controls, labels, contrast, reduced motion and font-loading failure states work.
- [ ] Cross-workspace preset reads/writes and unauthorized template.manage operations are denied; presets contain no personal content.

Arbitrary template code authoring is not included. See [capability coverage](../resume-capability-coverage.md) and [Phase 6](../build-plans/06-builder-expansion.md).
