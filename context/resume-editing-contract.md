# Contextual Resume Editing Contract

## AI action and replacement review — 2026-10-10

AI consent checkboxes are removed at the user's request. The explicit Improve with AI action sends only selected saved description/visible achievements; opening the dialog never submits. JD method buttons keep their broader professional-only scope distinct. Provider processing intent remains explicit in the existing API payload. Scoped proposal review now shows word-level struck-through removals and adjacent replacements with full Original/Suggested disclosures. Cancel/failure do not save; Apply preserves current version checks, target isolation and one immutable version. Shared prompt/validation grammar permits narrow shorthand and action inflections while guarding other factual vocabulary, numbers, negatives and slash-separated technologies. [Current contract](../docs/ats-workflow.md#explicit-ai-actions-and-inline-review--2026-10-10).

## Current no-JD guidance and import retention — 2026-10-09

General readiness uses versioned `readiness-v2` rule families with exact-entry Fix/View and per-check Dismiss/Restore. Additional editing advice is score-neutral and cannot change approved weighted math. A family completes only after every current instance passes. Old rubric history remains readable; current-version/rubric checks prevent stale preference writes and refresh without creating a content version. The private adapter supplies only contact-presence boolean guidance; no raw header/contact value enters resume-core or any AI projection. Manual header Fix uses the existing owner-only contact dialog.

Alternate-layout imports retain independent PDF columns, company-first role entries, all visible bullets, numeric months, CGPA, skill categories and language/proficiency fields. The source's fonts/emphasis/layout are not reconstructed. Confirmed existing imports remain immutable; fresh review/save is required. Editor primitives remain shadcn-based shared controls and Tiptap, with no Performative UI layer added to these cards. [Current workflow](../docs/ats-workflow.md#no-jd-rule-guidance-and-compatibility--2026-10-09).


## Current Gemini and compact assessment update — 2026-10-09

The user now selects paid **gemini-3.5-flash-lite** for semantic JD evidence and selected wording, superseding earlier Gemini-analysis-only/MiMo-rewrite instructions. Server keys, explicit per-request consent, professional/contact-free scope, grounding, immutable-version review/Apply and private gemini-embedding-001/768 retrieval remain. ATS groups all checks into five expandable areas; JD editor/breakdown/evidence collapse after evaluation. Approved numeric rubrics stay deterministic. OpenCode SDK/native/HTTP and unused Textkernel runtime/tests are removed; legacy stored proposals/public result schemas remain readable. [Current configuration, API behavior and limits](../docs/ats-workflow.md).


## ## Connected scoped wording and JD actions — 2026-10-09

ATS Fix opens the exact current entry and its description/guidance. Improve with AI requires a clean saved version and explicit MiMo consent, requests only that selection, shows Original/Suggested, and applies the stored proposal as a new immutable version. Cancel/failure preserve content; stale versions and expired proposals fail. Gemini is used only for optional JD semantic evidence. The timed local preview no longer serves the real editor. Live MiMo access is blocked by OpenCode free-tier client restrictions. [API, privacy, formatting and verification limits](../docs/ats-workflow.md).

## General readiness and edit freshness — 2026-10-09

The personal saved editor opens ATS Score and automatically checks a missing/outdated no-JD `readiness-v1` assessment on the current immutable saved version. Manual dialog candidates and applied local edits show a labeled Unsaved preview using the same contact-free pure projection/scorer; inline text contributes after blur/Enter. Preview never persists an assessment or changes content automatically. Save remains explicit; successful save triggers a version-bound check while the panel is visible (otherwise on reopening), while failure preserves stale evidence and a Retry action. Persisted run/preferences are disabled during pending edits, dialogs, conflicts and saves; manual navigation remains available between draft edits. Fix opens the current stable section/entry with issue title/reason, live check guidance and Go to field. View selects it; global Fix opens Edit Content with guidance. Deleted means persisted feedback dismissal with Restore and no score increase. Completed means all satisfied checks in the displayed saved assessment or explicitly unsaved preview; missing/removed rules do not imply resolution. Header/contact/source/hidden/layout data is excluded. JD matching, provider AI and actual exported-PDF checks remain disconnected. This supersedes earlier Completed-to-resolved planning semantics. [Manual checks](../README.md#general-resume-readiness--2026-10-09).

## Current A4 presentation correction — 2026-10-08

The user explicitly requests a compact one-page builder and non-overlapping scroll controls. The fixed A4 paper (794×1123 CSS pixels minimum) uses bounded compact defaults where appearance is absent, preserving saved settings and all populated facts. Fit page/Fit width/100% changes only view scale; responsive app chrome must not reflow paper date/skill columns. Desktop contextual actions belong to the sticky header instead of paper gutters; the whole tool rail sticks/scrolls together. Long content remains in an extended sheet with an overflow notice and estimated page count. This is not automatic formatting-fit, shortening, full pagination or PDF parity. [Actual evidence and manual checks](../README.md#a4-resume-page-and-scroll-controls--2026-10-08) supersede the earlier continuous-canvas/52px-gutter presentation notes. Existing reviewed edit, privacy and expected-version-save contracts remain authoritative.

## Implemented personal persistence extension — 2026-10-04

Owned blank/reviewed-import documents now use a strict shared `EditorDocument` in private Resume/ResumeVersion content alongside a backward-compatible flattened projection. Stable section/entry/achievement/group/tag/language IDs, dates, visibility, rich text and appearance survive save/reload. Acknowledgment checkpoints the captured save snapshot; typing after submission remains dirty. Creation replays return the original without new audit/version writes. Save validates expectedVersion and serializes mutation/version/audit atomically; conflict retains edits and requires reload.

Dialog Save remains a local draft transaction. The workspace action is now Save changes and creates a durable version; Cancel restores the last acknowledged document. Local history clears on navigation, but saved versions persist. Real documents start with OAuth display name only and no fictional autofill. Upload staging is untrusted until explicit review/confirmation; no master professional or UserContact mutation occurs. Private owner-only contact values may exist in resume-local snapshots/source text. No shared read, export or AI route exposes them; D12 separation/variants and contact-domain integration remain gated. These rules supersede local-only/sample statements below. Grounded AI proposal persistence remains proposed.

**Import field extension — 2026-10-08:** Optional `header.links` stores up to 30 private resume-local label/HTTP-or-HTTPS URL pairs with globally unique stable IDs. The header form/paper and flattened projection preserve these through reviewed creation and subsequent immutable versions. Existing documents without links remain valid. Imported language group/bullet values map to the existing language model, retaining item IDs and visibility rather than using the section title as a language. This changes no master profile/contact data or AI/shared/export access. Previously saved imports keep their confirmed editor documents; parser fixes apply only to fresh upload review.

**Frontend clarification — 2026-10-04:** Spoken Languages are grouped under Skills in the local document and dialog, with distinct language identity/proficiency retained. Skills is a dialog-only editing region, without a floating AI/item toolbar. Category/tag Save projects only that Skills section (including languages), leaves contacts and other sections intact, and commits one history step; Cancel restores the opening draft. This replaces the older Skills inline-action presentation only; proposed backend/AI contracts remain gated. [Local contract and bounds](../docs/manual-editor-contract.md#skills-grouping-correction--2026-10-04), [verification](../docs/manual-editor-verification.md#skills-dialog-and-compact-spacing--2026-10-04).

**Updated:** 2026-10-03. **Proposed backend/AI contract; local E01–E05 manual editing is implemented; backend/AI behavior remains proposed.** The user requests section-specific prompt assistance and resume-building/tailoring functionality. This document defines how to add those capabilities to F06/F08 while retaining the master-profile and privacy boundaries.

## Implemented frontend-only boundary

The user authorized local E01–E05 after V01. The [local editor verification](../docs/manual-editor-verification.md) and [transaction contract](../docs/manual-editor-contract.md) record direct canvas editing, stable target dialogs, ordering/visibility/delete, empty-only fictional autofill and full-draft history/checkpoints. Summary and rich descriptions reuse the constrained shared Tiptap adapter. Separate demo contacts are synthetic only. Save locally/Cancel never create persisted versions or mutate the master profile; reload/navigation/session loss clears state. Real blank/profile creation, protected contact integration, durable saves, grounded AI proposals and renderer/PDF contracts below remain pending.

## Required frontend extension — 2026-10-03

The user's screenshot follow-up requests the remaining header/section forms, contextual toolbar with move arrows and Edit dialogs, categorized Skills/Languages, ATS issue tabs and Export PDF. [Field coverage and acceptance criteria](../docs/frontend-editor-plan.md) distinguish these required UI capabilities from the unresolved dependent backend/scoring/render choices. No new runtime behavior is implemented by this update.

Dialog Save commits a validated target edit into the current local draft; Cancel restores the dialog's opening snapshot, while the workspace Save locally checkpoints the whole draft in memory. Reuse one shared history and stable section/entry identity. Define stable bullet identity before bullet reordering; move actions stay within their target list. Show/hide is reversible document visibility; delete removes selected draft content; neither is ATS issue dismissal. Phone/email remain separate protected manual header fields and are never AI targets. Real header loading/saving and export remain gated by D12 and current server permissions.

Summary's inline action bar excludes move arrows. Section ordering is a separate navigator action; entry/bullet ordering belongs to a stable list. Reject out-of-range moves before any state/history/save mutation and show an accessible highest/lowest-position error popup without taking focus. Cover first, last, single-item and stale-target cases. This user-requested clarification supersedes the earlier boundary-disabled-control proposal; its local implementation is verified; future server mutations must enforce the same guard.

## User flow

1. Open a saved resume, create a blank structured draft, or copy authorized profile facts into the initial template. A basic draft can omit a JD; JD tailoring requires a selected, parsed JD.
2. Select Summary, an Experience entry/bullet, a Project, Skills, Education or Certifications through explicit section controls. An optional text selection maps to a stable item; pixel coordinates or a PDF canvas are not the editing contract.
3. Show the selected target and its scope in a contextual Prompt panel. Clicking or selecting content only opens controls; it never submits to AI or changes saved content.
4. Choose an action such as Improve wording, Make concise, Emphasize supported impact, or Tailor to this JD; optionally supply a custom instruction. Actions unavailable for a section or missing JD are disabled with a reason.
5. Submit explicitly. Show real task state and keep the current resume usable. The request can be retried safely; switching sections cannot redirect a result to another target.
6. Show readable original/proposed text, a short reason and supporting fact references. Unsupported requested facts are explained as missing evidence, not inserted.
7. Apply the reviewed suggestion to the selected section as a new saved version, or Discard it. Retry creates another proposal, not an automatic edit. Undo unsaved manual edits locally; restoring saved content creates another version and preserves history.
8. Mark prior scores and PDFs stale for the new version. Recompute against the selected JD and export that exact version through existing permissions and tasks.

On mobile, use an accessible panel/sheet with a clear target label and reliable focus return. Keep a section list/edit button alternative when the rendered PDF cannot support direct selection. A Before/After comparison must be readable using keyboard and assistive technology.

The signed-in reference review confirmed section forms, separate manual Save/Cancel, immediate AI suggestion generation and a Cancel/Accept review surface. Our proposal deliberately makes target selection and request submission distinct, then uses the existing single explicit Apply transaction. It does not add a second hidden save or claim identical persistence behavior to the reference. Exact observations and untested actions are in [frontend integration](frontend-integration.md).

## Draft and selection identity

Proposed structured content contains stable `sectionId` and `itemId` identifiers, a section type, allowed text fields/order and source fact references. They survive edits/reordering and are resolved under the authorized resume version. Contact/header fields are not eligible AI targets.

Basic creation copies supported professional facts into a draft without needing AI or a JD. `Resume.jdHistoryId` may be absent for this mode; JD `atsScore`/breakdown are absent rather than zero; separately requested general readiness may populate its own metadata namespace. A completed content status means a usable content version exists, not that scoring or export has occurred. JD-specific scoring requires a supplied JD. Selecting a new JD for tailoring does not overwrite the provenance of older versions.

Save or discard unsaved manual edits before requesting a suggestion, so the suggestion always names a persisted base version. Do not silently send a half-edited browser buffer as though it were saved. D03 sharing and D12 header policies still gate dependent data behavior.

## Service and engine boundaries

The browser sends resume/base-version identity, expected resume revision, the selected stable target, action, bounded instruction and optional scoped JD reference. It never supplies actor authority, arbitrary JSON paths, provider credentials or an unrestricted replacement document.

The resume service authenticates and authorizes all inputs, resolves the selected subtree, fetches only permitted supporting facts and dispatches the existing durable-task pattern. The core accepts contact-free data and a typed target, returns a validated scoped proposal and provenance, and has no UI, tenant, HTTP, ORM or storage dependencies. Performative UI renders controls; it does not implement these domain operations.

Validate an allowlisted replacement structure for the selected target. Check unsupported qualifications, changed employers/dates/metrics, injected instructions, unsafe markup, known contact leakage and attempts to modify unselected sections. A prompt asking for missing factual claims asks the user to confirm facts through manual resume editing, reviewed F19 intake, or the separate profile editor first; prompt text alone does not count as factual confirmation. Contact is handled only by dedicated manual permissioned controls.

## Proposed suggestion persistence

The resume service owns a `ResumeSuggestion` relation with: ID, workspace/resume/base-version IDs, expected revision, stable target, action, optional JD revision, source profile revision/fact references, validated proposal, model/prompt/schema metadata, lifecycle timestamps and nullable applied-version ID. Proposed states are queued, running, ready, applied, discarded and failed; stale is derived when the base revision no longer matches. TaskRun kind distinguishes full generation from section suggestion.

Treat user instructions and proposal text as private content. Persist only what recovery/review requires under D11 retention; no raw prompt or proposed text in audit events, routine logs, tracing or public task metadata. Operational events expose IDs and safe status only. Bound proposal size, TTL/retention, provider input/output and concurrency before release; exact limits are implementation settings awaiting validation.

Apply takes a suggestion ID, expected resume revision and idempotency identity. The server reloads the stored validated proposal and current policy; it does not trust a browser-supplied patch. In one transaction it allocates the next version, applies only the selected subtree, records suggestion linkage/current pointer and local audit intent. Only the selected content subtree changes. Header references, unselected sections and master-profile facts remain unchanged. Existing versions remain immutable.

If the current version, target, JD context or authorization is stale, return a conflict/denial and require re-review or a fresh suggestion. Do not auto-merge a late AI response. Replayed Apply returns the same applied version. Failed jobs and discarded suggestions cannot replace good saved content. Delete/revocation prevents workers publishing or clients retrieving a suggestion.

## Planned API additions

All routes use `/api/v1`, the existing workspace selector and normal scoped error envelopes. These routes are proposals for F06/F08, not implemented APIs.

| Method and relative route                            | Input / result                                                                                                     | Permissions and scope                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `POST /resumes`                                      | Mode blank/profile-copy, profile association, template ID/version, optional JD → initial draft/version             | `resume.create`, `profile.read`, `template.view`; authorized profile/workspace |
| `POST /resume/:id/suggestions`                       | Base version, expected revision, target, action, instruction, optional JD, idempotency → owned suggestion/run; 202 | `resume.read`, `resume.generate`, `resume.update` and input read access        |
| `GET /resume/:id/suggestions/:suggestionId`          | Private proposal/reasons/provenance/status                                                                         | `resume.read` plus current target/input access; no raw provider payload        |
| `POST /resume/:id/suggestions/:suggestionId/apply`   | Expected revision + idempotency → one new version                                                                  | `resume.read`, `resume.update` and current input/resource access               |
| `POST /resume/:id/suggestions/:suggestionId/discard` | Expected suggestion state → terminal discard                                                                       | `resume.update` and parent scope; cannot undo an already applied version       |

Manual saves continue using `PUT /resume/:id`. Restoring a previous version uses an explicit validated save of permitted content with current revision checks, not mutation of history. Dismissing a panel need not cancel a task; define discard of a running result so it cannot later be offered for Apply.

No new permission names are added. No new MCP tools are implied; the seven planned tools remain unchanged. Later MCP editing would require separately reviewed suggestion/apply contracts with the same policy and explicit mutation intent.

## Acceptance scenarios

- Selecting a summary/bullet opens the right composer without a network mutation; keyboard/touch users have an equivalent path.
- A basic resume draft can be created without a JD and displays scoring as unavailable until a JD is supplied.
- A permitted rewrite changes only the selected target, retains supported facts and leaves UserProfile/UserContact and old versions untouched.
- A malicious instruction or unsupported metric cannot make a valid proposal; contact values do not appear in prompts, diffs, logs or restricted outputs.
- Duplicate submission/apply, late task completion, two tabs, target deletion/reordering and changed JD revisions preserve version integrity.
- Workspace switch, session expiry, denied generation, revoked membership/grant and deleted resume clear or deny stale suggestions and task tokens.
- Apply updates the preview and version only after successful persistence; failed save preserves the prior version and gives a retry path.
- Scoring/export correspond to the new version and correct JD/header visibility; historical artifacts are never labeled current after an edit.
- Reduced motion, IME/keyboard submit, accessible comparison, mobile sheet focus and actual busy/error states pass browser review.

See [frontend integration](frontend-integration.md), [F06](feature-specs/06-resume-generator.md), [F08](feature-specs/08-resume-preview.md), [data model](data-model.md), [API reference](../docs/api-reference.md) and [validation strategy](validation-strategy.md).

## U06 structure, grounding and appearance extension

Blank mode starts with empty professional sections while retaining an authorized profile association for ownership/contact policy; it does not require completed professional content. Profile-copy mode is explicit. Typed add/remove/reorder/manual edits use stable IDs, constrained formatting and expected revisions. Unsaved undo/redo is local; persisted restoration always creates a new version.

Proposed grounding expands to user-confirmed resume-local facts as well as permitted master-profile facts. Store origin (profile revision, manual confirmation or confirmed import), fact ID and confirmation revision. AI cannot promote its own output or an unreviewed extraction into evidence. Conflicting facts need explicit user resolution; changing a fact invalidates pending suggestions that used it. This is a proposed U06 contract extension, not permission to modify UserProfile/UserContact.

F20 appearance saves follow the same immutable version/conflict rules, but only change validated template/settings fields. They invalidate artifacts and formatting-dependent scores. Text facts, protected headers and unrelated sections remain unchanged. Fit-to-page does not silently shorten content. Full capability mapping is in [coverage](resume-capability-coverage.md).

## Section-footer control correction — 2026-10-08

The requested frontend now hides workspace navigation while the editor/intake is open and restores it on the library. The A4 view always fits width. Contextual actions are an unscaled overlay centred 6px below the selected entry in Work experience, Education or Projects; a bullet uses its enclosing entry. Header, section heading and Summary selection retain their own region footer. This entry correction supersedes the earlier whole-section anchor. They add no printable spacing and disappear in Preview. Phone screens use the same anchor with touch targets. A 150ms cancellable hover transition keeps actions reachable through adjacent sections; explicit click/keyboard selection remains immediate. Existing reviewed edits, dialog focus recovery, history and versioned persistence contracts remain unchanged. ATS UI displays an empty meter and Not evaluated until a real version-bound evaluation is connected. [Implementation checks and manual steps](../README.md#editor-sidebar-ats-meter-and-section-actions--2026-10-08).
