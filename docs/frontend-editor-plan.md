# Frontend editor completion plan — 2026-10-03

## Current audit status — 2026-10-11

Core manual fields/dialogs, saved library/import, scoring actions, paid Gemini review/Apply and current-version PDF are connected. Full generation/version-history/custom-section/shared release scope remains incomplete. Do not repeat the original initial-foundation prompts.

See the [full source-linked audit](implementation-audit.md). Dated checkpoints below remain history.

## Editor tool panels — 2026-10-04

The latest user request explicitly adds Back to all resumes and Edit Content / Customize Template / ATS Score / Optimize for JD tools beside the paper. This supersedes the earlier no-sidebar instruction for navigation and section shortcuts only: direct paper editing and the existing target dialogs remain authoritative; there is no duplicate text editor.

Implemented one bounded browser-only slice: collapsible tool rail/panel; existing section dialogs/add/order/visibility/confirmed delete; one original Forge Classic template preview; compact/balanced/spacious presets, bounded margins/spacing and four typography roles; honest ATS status filters and a local JD composer. Formatting joins the whole-draft checkpoint/history and cannot change facts or contacts. Fonts are existing system fonts, colors are a dark allowlist and minimum body size is 12px. Editor reserves a stable 52px section action gutter on desktop; Preview uses the actual selected spacing. Mobile uses a horizontal tool switcher and scrollable panel.

Full F20 gallery, durable settings, fit-to-page and PDF parity are not activated by this local slice. E06–E09 and D07/D09/D12 remain gated. [Results and manual checks](editor-panels-verification.md).


## Latest Skills requirement — 2026-10-04

Implemented the user's supplied category/tag dialog reference: Languages now appear inside Skills, keeping spoken and programming languages distinct; Skills opens its dialog on click or Enter/Space and has no floating AI/action bar or inline text fields. Manage default/custom categories, rename/order/delete, editable/removable tags, explicit suggestions and optional language proficiency through the existing local Save/Cancel/history transaction. Paragraph/bullet/skill rows have no extra new-line margin. Retain the white resume and Forge controls. This overrides earlier separate-Languages and Skills-toolbar requirements below. [Contract](manual-editor-contract.md#skills-grouping-correction--2026-10-04) defines bounds; [verification](manual-editor-verification.md#skills-dialog-and-compact-spacing--2026-10-04) records 17 tests, desktop/keyboard checks and mobile verification pending. E06–E09 gates are unchanged.

**Status:** Summary foundation, V01 and local E01–E05 canvas-first manual editing verified; E06–E09 service integration remains pending. The [tracker](../context/progress-tracker.md) is the implementation authority.

## V01 — resume document design

**Complete:** [Actual verification and screenshots](manual-editor-verification.md#v01-verification--2026-10-03). This completes the visual slice only.

V01 was completed before E01–E05. Preserve the Summary adapter, shared history and shell authentication; render all six sections using an explicitly synthetic local display fixture, separate from future persistence and protected contact contracts.

Design tokens: Paper `#FFFFFF`, Ink `#222222`, Secondary ink `#555555`, Rule `#454545`, Canvas `#EEF1F6`, existing Forge accent `#4338CA`. Georgia/Times serif carries the resume; system sans remains in the editor. Center the name, italic headline and wrapping contact line, then use a single left-aligned column with right-aligned dates, hanging bullets and compact labeled skill groups.

```text
Sections panel       Paper
Summary              Centered name / headline / contacts
Experience           SUMMARY __________________________
Education            Paragraph
Projects             EXPERIENCE _______________________
Skills               Role                         Dates
Languages            Employer
                     • Achievement
                     EDUCATION / PROJECTS / SKILLS / LANGUAGES
```

Review against the brief: the reference's resume hierarchy is intentional here, including restrained uppercase document headings. Remove content cards, colored section outlines and heading buttons from the paper; keep controls, synthetic labels and service limitations outside it. The paper grows with long content rather than clipping to a simulated page. No decorative animation or new template controls.

Acceptance: all six sections render; Summary stays synchronized, editable and undoable; dates and bullets align; contact/skills text wraps on narrow screens; keyboard focus remains visible; Preview has no editing controls; long content grows without clipping. Capture before/after screenshots and record actual checks before marking V01 complete. AI, ATS, PDF, real contacts and durable save remain pending.

The pending editor plan supplements [F08](../context/feature-specs/08-resume-preview.md), [F07](../context/feature-specs/07-ats-scoring.md), [F09](../context/feature-specs/09-pdf-export.md) and the [editing contract](../context/resume-editing-contract.md).

The user supplied five CareerZenith screenshots showing a contact/header layout, section actions, an ATS panel and a scrollable Project edit dialog. They clarify the requested interaction. Visible buttons are evidence of controls, not proof that the reference's scoring, reordering, AI or PDF export works. No private reference URLs, account data or screenshot binaries are copied into the repository.

## Required fields and forms

| Section | Required editing coverage | Acceptance criteria |
| --- | --- | --- |
| Personal information | First name, last name, professional headline; separate City, State/region and Country fields | Editing updates the resume header immediately; empty placeholders are excluded from Preview/export. Names and location are professional data; map these fields to the existing `fullName`/location contracts explicitly before server integration. |
| Protected contact | Phone number and email | Dedicated manual fields, separate from professional content. Actual values require server-authorized `UserContact`/header projection; unauthorized viewers receive no values in payloads, DOM or exports. No AI targeting or persistent browser storage. |
| Professional Summary | Preserve the working synchronized Tiptap editor; offer the same content through Edit dialog | Dialog and page share the supported normalized content and history. Do not rebuild or regress the completed Summary slice. |
| Work Experience | Job title, employment type, organization/company, location and location type; start/end month/year, current-role and year-only options; description/bullets and technologies/skills used | Add/edit multiple entries with stable IDs. Current role omits an end date; invalid date ranges show field errors. Save changes only the target; Cancel restores it, including canceling a newly added empty entry. |
| Education | Institution, degree, field of study, location, dates/current study; optional grade/CGPA and description/achievements/coursework | Multiple entries; optional grades have no invented default or assumed scale. Empty optional fields disappear from the document. Dates and entry identity follow the same validation/history rules. |
| Projects | Project name, role, start/end dates, ongoing and year-only options; rich description, technology stack and labeled links | Multiple entries. Preserve supported rich text; validate links against the allowed URL scheme before rendering. Do not auto-fill technologies, employers, metrics or sample qualifications into a real resume. |
| Skills | Programming Languages; Frameworks & Libraries; Tools & Platforms; Databases; Soft Skills | Edit/add/remove values within each named category. Category order is predictable; an empty category is omitted from Preview/export. No required minimum or suggested technology becomes a factual claim automatically. |
| Languages | Spoken/written languages, with optional user-entered proficiency | Separate from Programming Languages. Add/edit/remove entries without inventing fluency or certification. |

Phone/email support is a required deliverable, not permission to place contacts inside the contact-free body. Local form demonstrations use synthetic contacts only and show the same reset limitation as the current Summary editor. Resolve D12 and protected load/save contracts before using actual values. Resume edits never write back to the master profile.

## Selection, contextual actions and edit dialogs

- [ ] Clicking a section or entry selects a stable target. Clickable controls use a pointer cursor; editable text uses a text cursor. Show selection/focus outlines in Editor only. Keep the clean white document and all toolbars out of Preview/PDF.
- [ ] A compact contextual toolbar exposes **Improve with AI**, **Edit**, **Show/Hide** and **Delete** where supported. Add **Move up** and **Move down** only for orderable repeated entries/supported bullets. **Summary's inline toolbar has no move arrows**; keep its working text formatting and offer its required manual actions without implying a repeated-entry list. Keyboard focus and click/tap reveal the same bar; compact navigation/add controls remain outside the paper. Never rely on hover alone. Headers/contacts do not expose AI actions.
- [x] Desktop actions are centered below the entire containing section, including when an entry, achievement or skill is selected. Header actions use the header's footer. Selection preserves document geometry; content and toolbar resizing update the anchor. Mobile keeps its fixed action dock. Verified in the [2026-10-04 positioning correction](manual-editor-verification.md#toolbar-positioning-correction--2026-10-04); this does not change the selected action target or connect AI.
- [ ] Move controls operate on the selected repeated entry or supported bullet within its own list; they cannot move a bullet into an unrelated entry. Whole-section ordering belongs to the separate section navigator, including Summary if section ordering is supported. Stable identities and announced position changes preserve selection and history. Resolve stable bullet identity before adding bullet move actions to existing rich text. Dragging is optional.
- [ ] A move beyond the first/last position shows an accessible error popup/toast: **This item is already at the highest position** or **This item is already at the lowest position**. Keep boundary arrows actionable so the attempt explains the limit, instead of silently doing nothing. A list with one item rejects both directions. Invalid attempts do not change content/order, dirty state, selection, history or persistence; a stale/deleted target reports unavailability. Use the same guard for keyboard actions and server mutations. Announce the message without trapping focus or opening a blocking dialog; prevent duplicate repeated notifications.
- [ ] The Edit icon opens a shadcn/ui Dialog for the selected section/entry. Use a clear title, labeled fields, scrollable content and reachable Save/Cancel footer. On narrow screens use a full-height dialog/sheet with safe scrolling. Trap focus and return it to the invoking control.
- [ ] Dialog edits preview immediately through one draft. **Save changes** commits the validated edit into that local draft; **Cancel** restores the dialog's opening snapshot. Escape/close with changes offers Keep editing/Discard; opening a dialog or canceling a new entry cannot mutate unrelated content. The workspace's **Save locally** remains an in-memory checkpoint until durable saving exists.
- [ ] Add/remove/reorder/visibility changes participate in shared undo/redo and Save/Cancel. Delete targets only the selected item/section, offers clear confirmation and local undo, and preserves prior saved versions. Hiding retains content but excludes it from Preview/export; it is distinct from deletion and ATS issue dismissal.
- [ ] Improve with AI opens the selected-target composer. Explicit submit requests a grounded proposal; Before/After with evidence precedes Apply/Discard/Retry. No request on hover/selection, no automatic Apply, no master-profile/contact changes. Missing credentials, saved base version or evidence gives a truthful unavailable state.

**Live clarification — 2026-10-03:** Revisited CareerZenith at the user's request. The populated synthetic Summary's inline toolbar showed Improve with AI and text-formatting buttons, without entry move arrows. Separate section-heading move controls were present in the rendered DOM, so do not confuse section ordering with Summary text actions. An existing visible notification read “Cannot move item further in this direction.” This confirms the error presentation, not a successful reorder or independently reproduced top/bottom mutation test. Our exact toolbar/dialog choices remain the requirements above, rather than a claim that the reference has the same four Summary actions. See [reference follow-up](careerzenith-builder-review.md#summary-toolbar-and-move-boundary-follow-up--2026-10-03).

## ATS Score panel and suggested actions

Provide **ATS Score** beside the resume, with a text-labeled **Readiness Rating** and **Suggested Actions** tabs: **Pending**, **Completed**, **Deleted**, each with an actual count. Keep the internal issue states already specified in F07:

| UI tab | Internal state | Meaning and actions |
| --- | --- | --- |
| Pending | `open` | Outstanding evaluated issue. Show title, short explanation, target and evidence. **Fix** opens the correct field/dialog or AI composer; **View** selects the target; **Reason** reveals evidence; **Dismiss** moves the issue to Deleted. None submits AI automatically. |
| Completed | `resolved` | A newer evaluation confirms the rule is satisfied. Show the resolution evidence/version and target when it still exists. Manual editing or clicking Fix alone cannot mark it completed. |
| Deleted | `dismissed` | User dismissed the recommendation. **Restore** returns it to Pending if still applicable; otherwise explain the stale/resolved target. This deletes neither resume content nor immutable evaluation evidence and never increases a score. |

- [ ] Readiness is a versioned structural/completeness estimate; JD match scoring requires an authorized supplied JD. Without evaluation show **Not evaluated**, rather than a fabricated number/rating. Synthetic UI fixtures are labeled as examples.
- [ ] Rating labels, thresholds, rules and component weights remain pending under D09. The reference's “Poor” bars and minimum-skill count are not adopted as our scoring algorithm. If evaluation is partial/unavailable/stale, explain why and show its resume/JD/rule identity.
- [ ] Editing content marks affected results stale. Re-evaluation, not dismissing issues, determines readiness/score and Completed status. Handle unavailable rules/providers, deleted targets, empty tabs and restore conflicts without false success.
- [ ] Enforce `ats.view`/`ats.run` and actor-scoped dismissal preferences server-side. The panel remains usable with keyboard and mobile navigation; status never relies on color alone.

## Export PDF

- [ ] Put **Export PDF** in the compact workspace action bar, reachable in Editor and Preview. Before export is implemented, omit it or disable it with the specific prerequisite; do not provide a fake download or imply browser printing is the F09 pipeline.
- [ ] Require the intended saved version. For unsaved edits, offer Save and export or export the explicitly identified last saved version; no silent loss or export of an unapplied AI proposal.
- [ ] Recheck `resume.download`, ownership and contact access when generating and retrieving the private artifact. Use the same version/template/privacy rendering contract as Preview; current local Summary HTML is not yet PDF parity.
- [ ] Show honest preparing/ready/error/retry states. Validate selectable extracted text, complete fields, Unicode, links, page breaks and long resumes without clipping; no toolbars, placeholders, ATS panels, hidden sections or restricted contacts in output.

Private storage/runtime choices remain behind F09/D10/D12; local PostgreSQL remains the approved database. PDF export is required but not implemented by this documentation update.

## Frontend design direction

Retain resume-forge's original identity. Use canvas `#EEF1F6`, paper `#FFFFFF`, ink `#172033`, secondary ink `#536079`, cobalt `#4338CA` and divider `#E0E4EC`. System UI serves controls; Georgia serves the resume name. Keep left-aligned fields and document body, clear type hierarchy and quiet section rules. Existing dark chrome tokens remain; paper stays opaque white with dark text.

```text
Back / resume title   Editor | Preview   Undo Redo   Save status   Export PDF
Section navigation / Add / ATS       [ editable white resume document ]
                                     selected region → contextual action bar

Edit dialog: target title / close
             labeled fields in a scrolling body
             Cancel                  Save changes
```

The user rejected the duplicated Edit Content panel. Desktop now prioritizes one editable paper with anchored contextual actions and structured dialogs; ATS can open separately with an honest unavailable state. Mobile uses the same paper and a fixed contextual bar, with scrolling dialogs and focus return. The document is the main visual; prioritize generous readable paper space over decorative cards. Dialogs and contextual actions provide the interaction the user requested without adding a general canvas library. Performative UI remains suitable for contextual assistance and restrained app accents, never resume text/PDF.

## Bounded development order

E01–E05 were delivered as one connected local flow under the user's complete-editor request. Remaining rows require their own bounded implement-and-verify prompts. Preserve the completed Summary foundation and existing Vite/React/Hono, shared adapters, authentication and privacy policies.

| Slice | Scope | Dependencies / completion evidence |
| --- | --- | --- |
| E01 — local complete | Local Work Experience entry editing and the reusable Edit dialog lifecycle | Completed F01/Summary foundation; define typed stable entry IDs and local draft snapshots. Verify two entries, target-only Save/Cancel, dates, shared undo/redo and desktop/mobile/keyboard dialog behavior. No AI credentials or real contacts required. |
| E02 — local complete | First/last name, headline and City/State/Country local header editing | Define explicit professional header draft fields; no implicit `fullName` database change. Verify synchronization, empty fields, long/Unicode names and history. |
| E03 — local complete | Education and Project forms, delivered one form type per slice | Reuse verified dialog/entry/history patterns; validate dates, optional grade and project links. |
| E04 — local complete | Categorized Skills and Languages forms | Define typed categories and language entries; verify add/remove, empty states, ordering and target-only edits. |
| E05 — local complete | Contextual AI/Edit/Show-Hide/Delete, orderable entry/bullet move arrows and separate section ordering | Summary inline toolbar omits arrows. Stable identities for supported targets; verify first/last/single-item error popups with zero history/content change, valid ordering, keyboard/touch access, undo/redo and Preview continuity. Keep unavailable AI action explained. |
| E06 | Real blank/profile drafts, protected contact/header editing, durable saves and recovery | Owned profile creation/contact and resume-service/version contracts, D12, permission checks and audit capture. Separate commits for blocked boundaries; verify reload, revision conflicts, access revocation and contact-free payload/DOM. |
| E07 | Real selected-target AI improvement | F06/provider credentials, confirmed facts and saved base versions; verify grounded review/apply, stale results, target isolation and master/history integrity. |
| E08 | ATS readiness and issue panel | UI may start with clearly labeled synthetic states; actual ratings/lifecycle require D09/F07 and exact-version evaluations. Verify Fix/View/Reason/Dismiss/Restore, stale states and permission boundaries. |
| E09 | Functional Export PDF | F08 renderer parity and F09/D10/D12 private artifact pipeline; verify exact version, current contact access, visual layout, extracted text and failure/retry. |

E07–E09 depend on their own contracts and need not wait for one another if independent prerequisites are satisfied. Full F20 gallery/customization, fit-to-page and file import stay in their existing proposed allocation; the screenshots do not activate them.

For each implemented slice, run relevant package/root checks and inspect desktop, narrow mobile and keyboard flows with synthetic data. Update the tracker with actual commands, results, remaining limitations and manual steps. Documentation capture alone completes none of these acceptance checkboxes.

## Canvas-first implementation — 2026-10-03

The [local contract](manual-editor-contract.md) and [verification](manual-editor-verification.md#e01e05-canvas-first-verification--2026-10-03) supersede the original panel sketch. Header/contact-demo fields, headings, entry text/achievements, categorized skills and languages edit directly on the paper; Summary and entry descriptions reuse Tiptap. Dates and links use the validated Edit dialog. Hover/focus/click reveals the contextual bar outside the paper; Summary has no item arrows. Empty-only **Auto-fill sample details** is available in every relevant dialog, explicitly fictional, preserves typed values and stable IDs, and supports local Undo/Cancel. It never supplies facts to a real profile or AI.

Local dialog transactions, repeated entry/bullet/skill/language ordering, boundary/stale guards, section ordering, hide/delete/Undo, missing-section creation, Preview and full-draft Save/Cancel/history are implemented. Real protected contacts, durable versions and E07–E09 remain pending; the general acceptance checkboxes above include those future integrations and are not full-product completion claims.
