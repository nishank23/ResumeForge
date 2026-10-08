# F08 — Resume Builder, Preview and Initial Template

## Current A4 page correction — 2026-10-08

The user's bounded frontend request now provides fixed A4 geometry, compact defaults, view-only Fit page/Fit width/100%, and scroll-safe rail/panels. Selected desktop actions sit in the editor header; empty optional fields and editing gutters no longer lengthen the paper. The supplied one-page import measures 794×1123 with all 69 checked populated fields preserved across desktop/tablet/phone. Long content remains intact with an overflow notice and estimated page count. This does not complete multi-page rendering, automated formatting-fit or PDF parity. [Changes and manual checks](../../README.md#a4-resume-page-and-scroll-controls--2026-10-08) supersede prior canvas/gutter presentation notes; F08 remains partial.

## Owned manual resume integration — 2026-10-04

Blank creation, uploaded-file review, owned load and explicit expected-version Save changes are connected to the restricted personal service/database. Strict editor JSON preserves rich text, stable IDs, dates, visibility, languages and appearance through immutable versions. Sample resume/autofill is removed from the normal account flow. Temporary AI Accept still edits the working draft and needs Save changes; no real AI, ATS or PDF export is enabled. Earlier local-only appearance/checkpoint descriptions below are history. [Current checks and limits](../../README.md#resume-library-upload-and-database-saves--2026-10-04). Full F08/E06 privacy, renderer and service acceptance remains partial.

## Temporary frontend AI dialogs — 2026-10-04

The explicit frontend-only request adds selected-target setup, temporary Thinking, inline Suggested changes and No changes needed dialogs. Local conservative wording examples clearly say AI is disconnected; Accept/Cancel and Undo reuse current draft transactions. No provider, public contract or durable version is implemented; grounded E07 and F08 service acceptance remain pending. [Actual checks and manual steps](../../docs/ai-preview-verification.md).

## Local editor tools extension — 2026-10-04

Implemented the user's explicit rail/panel request: Back to all resumes with local-loss confirmation, Edit Content section shortcuts, Customize Template local settings/one original preview, honest ATS filters and local JD preparation. The existing canvas, target dialogs, Summary, grouped Skills and history remain intact. Optional local `appearance` joins whole-draft checkpoints/history; it is not a persisted resume/render contract. Desktop editing gutters prevent action overlap; Preview uses actual spacing. [Results/manual checks](../../docs/editor-panels-verification.md). E06–E09 and full F20 remain pending.

**Latest local UI correction — 2026-10-04:** Languages render/edit inside Skills while remaining distinct from Programming Languages; clicking or keyboard-activating Skills opens the category/tag dialog with no floating AI/action bar. Custom categories and tag management share local Save/Cancel/history; extra new-line margins are removed. [Contract](../../docs/manual-editor-contract.md#skills-grouping-correction--2026-10-04) and [actual verification](../../docs/manual-editor-verification.md#skills-dialog-and-compact-spacing--2026-10-04) supersede earlier separate-Languages/per-skill toolbar wording. This is frontend-only; mobile checks and all durable/service acceptance remain pending.

**Phase:** 2 — AI Pipeline · **Priority:** Critical · **Implementation:** Partial — V01 and local E01–E05 canvas-first manual editor verified 2026-10-03; full saved-resume/AI/renderer acceptance pending.

The user authorized these bounded frontend slices before remaining backend dependencies. See [scope and verification](../../docs/manual-editor-verification.md). The local sample uses synchronized Tiptap Summary, local history/checkpoints and continuous preview. V01 adds a professional serif document with centered synthetic header/contacts and Summary, Experience, Education, Projects, grouped Skills and Languages. Local field forms, direct paper editing, contextual actions, target-only dialogs, sample autofill and shared history are implemented. Controls stay outside the paper; durable/service integration remains pending. The fixture includes only explicitly fictional contact details and is not a persisted or server contact contract. Full F01/F06/D12 dependencies below still govern real persisted resumes.

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

## Required manual editor completion — 2026-10-03

The user supplied screenshot requirements captured in the [frontend editor plan](../../docs/frontend-editor-plan.md). This expands the pending acceptance detail, preserving the verified Summary slice:

- [ ] First/last name, professional headline and separate City/State/Country fields synchronize with the header; protected Phone/Email use dedicated authorized controls under D12.
- [ ] Work Experience, Education and Project repeated-entry forms implement the plan's fields, date validation, optional values and target-only Save/Cancel.
- [ ] Skills expose Programming Languages, Frameworks & Libraries, Tools & Platforms, Databases and Soft Skills; spoken Languages are grouped within Skills and support optional user-entered proficiency.
- [ ] Contextual Edit opens an accessible, scrollable dialog with focus return; manual updates synchronize page/panel/dialog and share local history/checkpoints.
- [ ] Selected sections/entries/supported bullets expose move up/down with stable identity and keyboard/touch alternatives. Supported visibility/delete actions are reversible and absent from Preview/export.
- [ ] Summary's inline AI/edit/visibility/delete actions omit item move arrows; whole-section ordering stays in the navigator. Repeated entry/bullet moves beyond first/last (including a single-item list) show an accessible error popup and do not change content, order, dirty state, selection or history. Stale targets recover without a false success. See the [live toolbar clarification](../../docs/frontend-editor-plan.md#selection-contextual-actions-and-edit-dialogs).
- [ ] Improve with AI opens the target composer without submitting; grounded review/apply remains F06 and the editing contract. Phone/email are excluded.
- [ ] ATS and Export PDF controls integrate F07/F09's actual states and permission/version boundaries; unsupported features never imply working scores/downloads.

Local E01–E05 now work against a typed synthetic draft; E06–E09 and full persisted acceptance remain pending; this does not activate full F20 or approve unresolved scoring/header/export choices.

### Local E01–E05 implementation boundary

- [x] Direct header/separate demo contact, headings, entry text, stable achievement, categorized skill and language editing; constrained Tiptap Summary/descriptions.
- [x] Reusable accessible target dialogs, validated optional dates/current/year-only/grade/HTTP(S) links, provisional new entries, target-only Save and reversible dirty Cancel.
- [x] Hover/focus/click contextual actions outside paper, no Summary item arrows, guarded list/section ordering, hide/delete/Undo, missing sections and Preview continuity.
- [x] Empty-only fictional sample autofill preserves entered values/IDs and is reversible with dialog Undo/Cancel; full-draft local checkpoints/history reset on reload/navigation.

These local checks do not complete the durable, protected-contact, AI, score or PDF acceptance above. [Contract](../../docs/manual-editor-contract.md) and [verification](../../docs/manual-editor-verification.md) contain actual evidence.
