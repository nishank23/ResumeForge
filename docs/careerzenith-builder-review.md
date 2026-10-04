# CareerZenith builder review — 2026-10-03

The user asked to inspect CareerZenith through **Upload or Create Resume → Create New Resume**, then use that interaction model to improve resume-forge before continuing backend development. This review records live desktop observations and a comparison with the current local app. It does not implement a builder or certify feature parity.

## Inspection scope and account effects

Inspected the user's authorized signed-in [CareerZenith dashboard](https://careerzenith.ai/dashboard). Created one blank draft named **Builder Review (Synthetic)** through the requested flow. Entered only synthetic first-name/summary text, added an Awards & Achievements section, selected Compact spacing, and changed the section-header font to Geist. This draft remains in the reference account. An empty second experience entry was canceled and removed by the UI. Existing resumes were not edited. No personal files/contact values were entered, no AI generation was requested, and no PDF was exported.

Browser observations used the normal desktop viewport, DOM/accessibility state and screenshots. A screenshot of the synthetic editor was saved outside the repository, with browser chrome and the private draft URL excluded. No competitor assets, code, template artwork or resume/account data were added to the project.

## Why it feels interactive

CareerZenith keeps the document visible throughout editing. A compact navigation rail changes the tool panel; the adjacent paper remains the working surface. Users can edit fields on the paper or use structured forms, see changes immediately, and switch to a clean preview. This is the useful Canva-like quality the user is requesting.

The inspected surface is a structured resume document editor. Arbitrary free-positioned objects, drag-anywhere text boxes, layers, image cropping or a general design canvas were not demonstrated. A canvas-library migration is not supported by this evidence.

## Observed and exercised behavior

| Area | Actual observation or test | Verification boundary |
| --- | --- | --- |
| New resume | Dashboard creation modal separates upload and blank creation. Create New Resume opened a blank structured draft. | Creation exercised. Upload/parser not tested. |
| Workspace | Narrow mode rail; section controls on the left; white document on the right; split-panel divider and collapse affordance. | Layout visually reviewed. Divider resizing/collapse not exercised. |
| Modes and toolbar | Edit Content, Customize Template, ATS Score and Optimize for Job switch the tool panel. Document toolbar exposes Editor/Preview, undo/redo and Export PDF; paper header exposes rename, page count and Fit to Single Page. | Mode navigation exercised. Undo/redo, export and fit behavior not verified. |
| On-page editing | Edited the first-name placeholder to synthetic text directly on the paper. Personal-information card reflected the change. | Direct editing and panel synchronization exercised; placeholder text is separate from actual field content. |
| Summary form | Opened a rich-text form with formatting controls and separate Save/Cancel. Typed synthetic text and applied bold; the paper updated during editing. | Live update and bold exercised. Saved summary remained after reload. Other toolbar formats not exercised. |
| Cancel/recovery | Canceling a changed summary opened a Save/Don't Save prompt. Don't Save restored the previous empty summary. | Discard recovery exercised. This is distinct from reload persistence. |
| Add section | Add Section lists Profile, Education, Professional Experience, Skills, Certifications, Professional Summary, Projects, Awards & Achievements and Custom. Selecting Awards added it to the controls and paper. | Addition and reload persistence exercised. Other section types and deletion not exercised. |
| Repeated entries | Experience exposes Add work experience and per-item icon controls. Add opened a second entry with title, employment type, company, location/type, month/year dates, current-role/year-only checkboxes, tech stack and rich text. | Empty entry addition/cancellation exercised; cancel removed the new entry. Saved populated entries and icon actions not tested. |
| Reordering | Section/item drag handles and keyboard drag instructions are present. Keyboard and pointer trials did not establish a changed section order. | Reordering remains unverified; do not claim it works or diagnose a site defect from automation trials. |
| Preview | Preview Mode hid empty placeholder fields and retained the synthetic name/summary and section headings. | Visible behavior exercised. Reload returned to Editor Mode; mode persistence is not claimed. |
| Rename and persistence | Renamed the new draft. Reload and reopening from the dashboard retained name, edited summary and added section. | Persistence of these specific changes verified; concurrent editing, version history and save-failure recovery not tested. |
| Gallery | Choose a template shows four visible cards. View all opens a dialog with All, College and content-density filters, preview cards and a request-template action. | Gallery inspected. Template switching, filter results and requests not exercised. No institution-specific assets to copy. |
| Density | Nine presets from Ultra Compact to Premium. Balanced showed 15.5px body size, 10px section gap, 7px item spacing and 20px padding. Compact showed 12.5px, 7px, 5px and 16px respectively. | Compact selection and changed values exercised; resulting 14.5px section-header size remained after reload. This is reference behavior, not our approved readable minimum. |
| Spacing | Separate controls for section gaps, item spacing and four-sided padding, with numeric inputs/sliders and increment/decrement buttons. | Controls inspected; individual spacing edits not exercised. |
| Typography | Separate Section Header, Heading, Subheading and Description controls for font, size, line height and color. Font dropdown included Tinos, Cinzel, Shantell Sans, Geist, Geist Mono and Instrument Serif. | Section Header font changed to Geist, confirmed by the paper's computed font and retained after reopening. Color, sizes, style variants and font-loading failures not tested. |
| ATS issues | Pending/completed/deleted issue groups with reasons and Fix controls. On the synthetic blank draft, Education Fix opened the corresponding education form with issue context and Go to field. | Fix navigation exercised. Algorithm accuracy, scoring quality and completion tracking not verified. Our rubric remains D09. |
| Job optimization | Empty history and Start New Analysis action. That action showed a readiness gate requiring a Good rating for this draft. | Gate observed. No JD submitted, analysis generated or AI credit use tested. Do not infer that our manual builder needs such a gate. |

Several icon buttons lack meaningful accessible names, and section containers contain nested buttons. Keyboard reordering did not produce a verified result. These observations are reasons to make our controls explicitly labeled and independently keyboard-operable. They are not a full accessibility audit. Mobile, screen-reader behavior, long resumes, multiple pages, PDF extraction, fit-to-page and provider quality remain untested.

## Comparison with resume-forge at inspection

Subsequently, the bounded local Summary workspace was implemented and verified; see [manual checks](manual-editor-verification.md). The user then supplied five screenshots requesting the remaining forms/actions, readiness panel and PDF control. [Frontend editor completion plan](frontend-editor-plan.md) records those pending requirements; the table below preserves the earlier baseline rather than describing the latest editor.

Inspected the running local library and sample editor at port 3000, and the current `ResumeRemoteRoot` through CodeGraph. The completed F01 visual foundation and authentication/session work remain intact. F08/F20 product behavior is still unimplemented.

| Current local behavior | Gap that affects the user | Required design direction |
| --- | --- | --- |
| General workspace sidebar plus breadcrumb, large heading and preview notice precede the document. | Much of the viewport is spent on surrounding UI before the editing surface. | Dedicated editor workspace with compact back/title/status/actions and more space for paper and tools. |
| White page contains bordered content cards and Select buttons. | Selecting a section feels like inspecting sample cards; users cannot type or arrange their resume. | Clean document layout with focus/hover selection, direct field editing and a synchronized section navigator. Keep action chrome outside printable content. |
| Section assistant is the main companion panel. | Manual entry, section structure and appearance tools are missing. | Content mode should be the default. Give formatting and section assistance their own contextual modes. |
| Four fixed synthetic sections and hardcoded sample rewrites. | Users cannot build from blank, add experiences/education, reorder or manage sections. | Structured draft with stable section/item identities, typed forms, add/remove/reorder and accessible keyboard alternatives. |
| Creation only selects a starting mode and opens a sample. | No actual blank or profile-based resume is created. | Start a real editable draft without a JD or AI request; preserve separate profile and resume ownership. |
| Applied suggestions remain React state and reset when the editor is left. | No durable save, revisions, undo/redo, export or restore. | Local draft history/Save/Cancel first, then protected server persistence and immutable saved versions. Show the real save state. |
| Static page label, one illustrative layout, no format controls. | No dependable page layout feedback or control over appearance. | Readable initial template and measured preview first; bounded formatting/gallery/fit-to-page follow the F20 contract. |

## Recommended implementation order

These are proposed bounded slices, not completed tasks or a promise to finish every phase in two days.

1. **Manual editor foundation and workspace:** replace the sample-card interaction with a dedicated document workspace, one original template, synchronized content panel, direct supported-field editing, structured section/item controls, keyboard ordering, local undo/redo and explicit Save/Cancel draft state. Keep synthetic/local behavior labeled until persistence is connected. No AI credential is required for this UI slice. Resolve a narrow draft/field schema and renderer contract before implementation; preserve the existing MFE/shared-package boundaries and Tiptap.
2. **Durable resume flow:** real blank/profile-based creation, scoped load/save, revision conflicts, immutable versions, contact-safe headers and unsaved navigation recovery. This depends on the relevant profile/resume service and D12 contracts. Browser storage must not become a private-contact persistence shortcut.
3. **Document appearance:** original gallery, compact/balanced/spacious presets, bounded margins/type/spacing/color, reset and previewed fit-to-page, sharing the preview/export contract. Bringing selected F20 work forward requires an explicit phase-plan update; this inspection does not silently activate all proposed Phase 6 behavior.
4. **Section AI and evidence:** retain the selected-section prompt and explicit request → review → apply flow, then integrate real credentials, grounded facts, JD context, stale-result handling and our approved scoring rubric. AI assistance must not replace manual editing or alter the master profile.

Retain our product identity, accessible shadcn/ui primitives, shared design tokens and calm document surfaces. Reproduce the interaction quality, with original visual styling and templates. Do not introduce the reference's job board/community, hiring claims, auto-filled qualifications or arbitrary canvas objects.

## Manual review steps for the next slice

Before marking the editor slice complete, use synthetic content to verify:

- Start blank; edit on the page and in the form; both views stay synchronized.
- Add two experience entries and an optional section; move/remove only the selected target, using mouse and keyboard.
- Apply supported bold/bullets; Undo/Redo and Cancel restore content, structure and selection predictably.
- Switch to Preview; editing chrome/placeholders disappear and long content remains legible without clipping.
- Show an honest unsaved/saving/saved/error state; reload persistence is claimed only when actually implemented and tested.
- Confirm mobile navigation, labeled controls, focus restoration and reduced motion. Keep protected contacts out of unauthorized payloads, DOM and exports.

Related contracts: [F08](../context/feature-specs/08-resume-preview.md), [editing contract](../context/resume-editing-contract.md), [F20](../context/feature-specs/20-template-customization.md), [UI context](../context/ui-context.md), [current tracker](../context/progress-tracker.md).

## Summary toolbar and move-boundary follow-up — 2026-10-03

At the user's explicit request, revisited the existing builder, then opened only the previously created **Builder Review (Synthetic)** through the dashboard. Selecting its populated Summary showed **Improve with AI** and text-formatting controls; its inline bar had **no entry up/down arrows**. The rendered section-heading controls separately contained direction arrows, distinguishing whole-section ordering from Summary text editing. The Work Experience item toolbar showed AI, down/up, edit, eye and delete icons; icon behavior other than selection remains outside this follow-up's proof.

The initially visible builder notification read **“Cannot move item further in this direction.”** This verifies an out-of-range error toast is displayed. A later move-button trial did not independently reproduce that notification; text-editing controls changed during inspection, so successful movement and separate top/bottom boundary tests remain unverified. No AI generation, hide/delete, export, new draft creation or intentional content save was performed. Do not claim that every control was exercised or infer a persisted-content guarantee from this inspection.

The [frontend editor plan](frontend-editor-plan.md) and [development prompts](development-prompts.md) now require the Summary inline arrow exception and an accessible highest/lowest-position error popup for rejected moves, with no content/order/selection/dirty/history mutation. These are pending implementation requirements. Valid reordering still needs its own test; the earlier unverified-reorder statement remains accurate.
