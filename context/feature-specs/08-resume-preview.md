# F08 — Resume Builder, Preview and Initial Template

**Phase:** 2 — AI Pipeline · **Priority:** Critical · **Implementation:** Not started

## Goal and dependencies

Let users build, inspect and edit a resume with a consistent initial template and reviewable section-specific AI suggestions. Requires F01/F06; integrates F07's breakdown. Resolve D12's protected-header rendering policy. The source's separate template-library filename is consolidated here for the initial registry; additional templates remain after Phase 5.

## Ownership and planned files

`apps/resume-mfe/src/preview/` and editor components, shared resume/template DTOs, `packages/resume-core/src/template-registry.ts`, and a browser-safe React PDF renderer module. Services supply sanitized version content and permitted header data.

## Build scope

1. Define TemplateDefinition with stable ID/version, supported sections, page layout, font assets, and renderer contract.
2. Build one readable, single-column template with selectable text, consistent headings, and controlled section ordering.
3. Render the same structured DTO on screen and through React PDF preview; share the rendering contract with F09's later server export.
4. Add constrained Tiptap bullet editing and section controls. Normalize/sanitize permitted text formatting; do not accept arbitrary HTML or executable links.
5. Save explicit edits as new versions with expected-revision checks. Show unsaved changes and stale score/artifact indicators.

## Privacy and states

Contact-free viewers receive no private header payload at all. Historical versions apply current access policy. A preview cannot display a previously cached contact-bearing version after a workspace/role change. Handle unknown template, unsupported old content schema, long sections, empty optional sections, renderer failure, and concurrent edits.

## Acceptance and verification

- [ ] A generated resume renders legibly with its version/template identity and ATS breakdown.
- [ ] User edits save a new version without changing the master profile or old versions.
- [ ] Long text and multiple pages do not clip; narrow-screen editor/preview navigation works.
- [ ] Restricted contact is absent from rendered DOM/PDF preview and client payloads.
- [ ] Unknown templates, stale saves, and renderer failures provide recovery.
- [ ] Representative document snapshots, keyboard editing, and version-conflict behavior are reviewed.

Persistent R2 download/export is F09. Custom template authoring and additional template packs are not included.

## Contextual resume builder — 2026-09-29 planning update

Add a section/item navigator and explicit edit buttons outside the PDF canvas; optional text selection resolves to the same stable target. Use shared Prompt with quick actions/custom instructions, JD context, honest progress, accessible Before/After, Apply/Discard/Retry and explicit version restoration. Save/discard manual drafts before requesting a suggestion. Apply changes only the selected target after successful server persistence.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Mouse, keyboard and touch users can select, request, review and apply one grounded change; unselected sections, contact headers, master profile and older versions remain intact.
- [ ] App backgrounds and assistant surface effects never enter resume content or interfere with section selection, readable comparisons, focus or preview/print layout.

Signed-in reference findings confirm section editing and suggestion review affordances. Preserve our explicit submit/apply semantics and own UI; observed template/style controls do not expand the initial-template scope automatically.

## Complete manual builder — U06

Support two explicit starts: blank structured draft or copy from authorized profile. No AI or JD is required. Manual resume-local facts do not update the master profile. Typed sections cover summary, experience, education, skills, projects, certifications and optional achievements/languages/volunteering/custom professional sections after schema validation. Allow add/remove/reorder of sections/items with stable identities, keyboard alternatives, local undo/redo and unsaved-change recovery. Delete only the selected draft content, with clear review before saving a new version; contacts remain dedicated protected fields.

Expose editor/preview modes and page count. F08 provides one template; F20 adds the full gallery/settings and fit-to-page workflow. Do not show a working upload/customization promise before those features exist.

- [ ] Blank and profile-based starts work without JD/scoring; empty placeholders never become invented facts.
- [ ] Section/item creation, removal, ordering, manual Save/Cancel and undo/redo preserve other content and older versions.
- [ ] Manual facts require explicit user confirmation before later AI grounding; contact values cannot be smuggled into unrestricted free text.
