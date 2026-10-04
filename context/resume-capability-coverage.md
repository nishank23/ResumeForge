# Resume Capability Coverage

**Current implementation — 2026-10-03:** V01 and local E01–E05 canvas-first manual editing are complete. Direct paper fields, Summary/description Tiptap, validated section/entry dialogs, grouped Skills/Languages, contextual move/edit/hide/delete, empty-only fictional sample autofill and full-draft local history are verified. The duplicated Edit Content sidebar is removed; keyboard/click selection reveals actions and mobile uses the same paper. [Tracker](progress-tracker.md) and [verification](../docs/manual-editor-verification.md) distinguish this synthetic, in-memory UI from pending real contacts/D12, durable blank/profile versions, grounded AI, ATS and PDF. Earlier slice descriptions below are dated history.

**Review date:** 2026-09-29; requirements updated 2026-10-03. **Status:** Planning register; current implementation is recorded in the tracker, including the partial local Summary editor. The user requested comprehensive resume-builder capability coverage from CareerZenith, with our own design. This register maps every resume capability identified in the review to a specification; it is not a claim to have discovered every hidden or paid feature.

The 2026-10-03 screenshot follow-up explicitly requests personal/header fields, complete Work Experience/Education/Projects, five Skills categories and separate Languages, Edit dialogs, contextual AI/move/visibility/delete actions, Readiness Rating with Pending/Completed/Deleted recommendations and Export PDF. Exact fields, states, dependencies and pending acceptance are in the [frontend editor plan](../docs/frontend-editor-plan.md); [development prompts](../docs/development-prompts.md) preserve the completed Summary slice.

## Evidence and scope

Sources: [CareerZenith dashboard and editor entry](https://careerzenith.ai/dashboard), inspected in the authorized signed-in Chrome session, and the public sources recorded in [frontend integration](frontend-integration.md). Private resume IDs, account details and resume text are intentionally omitted. “Observed” means a visible control or surface, not a proven backend outcome. This follow-up inspected menus and panels only; no new generation, save, clone, delete, upload, template application or export was triggered.

The earlier inspection generated one AI suggestion, canceled without Accept/Save; the original wording remained visible but the dashboard update date changed. Provider processing and credit effects are unknown. See the integration evidence for that limitation.

## Coverage register

| Capability | Reference evidence | Our planned behavior / owner | Phase |
|---|---|---|---|
| Start a blank resume | New Blank Resume entry observed | Empty structured draft; manual fact entry, no mandatory JD or AI; F06/F08 | 2 |
| Start from profile | Our existing product capability | Copy permitted profile facts without mutating master; F06/F08 | 2 |
| Upload an existing resume | Upload Resume / Upload File entry observed; public PDF/DOC claim | Reviewed extraction into a new resume; formats and limits under D14; F19 | 6 proposed |
| Resume list | Dashboard observed | Scoped list/cards, real status and score freshness; F10 | 3 |
| Search, sort, pagination | Search; Name, Readiness Rating, Updated At sorts; page-size controls observed | Title/role/company search; title, update time and available own score sorting; bounded pages; F10 | 3 |
| Active/default resume | Set as Active menu observed; not executed | Actor/workspace preference only, no implicit publication or job application; F10 | 3 |
| Clone and delete | Menu actions observed; not executed | Independent draft clone, authorized deletion and artifact cleanup; F10 | 3 |
| Resume naming | Named rows observed; rename interaction not tested | Explicit rename proposed for organization; F10 | 3 |
| Section navigation and manual editing | Section controls and Summary form inspected | Structured fields, constrained rich text, explicit Save/Cancel; F08 | 2 |
| Add/remove/reorder sections | Add Section, deletion and drag affordances observed; not executed | Typed optional sections, stable IDs and keyboard reorder; F08 | 2 |
| AI wording improvement | Earlier suggestion generated and canceled | Explicit request, grounded diff, Apply/Discard/Retry; F06/F08 | 2 |
| Section-specific custom prompt | User-requested extension; exact reference prompt scope unverified | Contextual Performative UI Prompt, selected target and supported actions; F01/F06/F08 | 1–2 |
| Undo/redo and saved restoration | Reference persistence/undo semantics unverified | Local unsaved undo/redo; restore saved content as a new version; F08/F10/F11 | 2–3 |
| Editor and preview modes | Both controls and page indicator observed | Responsive edit/preview navigation with page count; F08 | 2 |
| Fit to one page | Fit to Single Page control observed; not executed | Preview bounded spacing changes, no deleted facts or unreadable type; F20 | 6 proposed |
| PDF export | Export PDF control observed; not executed | Exact-version private PDF, selectable text and privacy projection; F09 | 3 |
| Template gallery | Template previews, View all and College Templates controls observed | Original template catalog with previews/categories; F20, initial registry F08 | 2 / 6 proposed |
| Layout density presets | Compact-to-spacious preset controls observed | Own bounded compact/balanced/spacious settings; F20 | 6 proposed |
| Margins and spacing | Four page-padding controls, section gap and item gap inspected | Validated render settings and PDF parity; F20 | 6 proposed |
| Typography and colors | Section Header, Heading, Subheading, Description font/size/line-height/color controls inspected | Allowlisted fonts, bounded size/line height, accessible colors; F20 | 6 proposed |
| Reset formatting | Reset to default observed; not executed | Preview reset to versioned template defaults; content unchanged; F20 | 6 proposed |
| ATS feedback and issue actions | Reason, Fix and pending/completed/deleted groupings observed | Our rubric, section links, open/resolved/dismissed issues; F07 | 2 |
| Tailor to a supplied JD | Optimize for Job / Optimize AI controls observed | User-supplied JD, grounded proposal and explicit version save; F05/F06 | 2 |
| Keyword feedback | Keywords view observed | Supported/missing terms; no invented qualifications; F07/F17 | 2 / 5 |
| JD and optimization history | Job Description, Optimization History, View Details and Restore observed | Version/JD provenance and explicit restore-as-new; F11 | 3 |
| Profile maintenance | Our existing product capability | Separate master-profile editor; no AI resume side effect; F04/F12 | 1 / 3 |

All rows have an owner; none imply feature completion. Original F01–F18 IDs and phase allocations remain stable. F19/F20 and Phase 6 are proposed additions for review, not an approved schedule or effort estimate. Import can be reprioritized only by updating dependencies and the roadmap together.

## Boundaries and unknowns

No job board, community, applications, recruitment, interview or hiring workflows. No competitor branding, private code, template artwork or claims of guaranteed ATS/hiring outcomes. Cover letters and billing remain unallocated. DOCX export, OCR, arbitrary HTML/template-code upload and real-time collaboration are not promised by this review. Exact accepted input formats, template inventory, paid limits, autosave semantics, mobile/accessibility behavior, scoring quality and actual save/restore/export outcomes were not established.

Performative UI backgrounds/surfaces/accents complement shadcn/ui in the app; Tiptap handles constrained editing and React PDF handles document rendering. Decorative effects never enter the resume or PDF. See [frontend integration](frontend-integration.md), [editing contract](resume-editing-contract.md), [roadmap](build-plan.md) and [decisions](decisions.md).
