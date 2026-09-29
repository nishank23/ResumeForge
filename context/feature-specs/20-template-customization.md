# F20 — Template Library and Formatting Customization

**Phase:** 6 — Resume Builder Expansion (proposed allocation) · **Priority:** High · **Implementation:** Not started

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
