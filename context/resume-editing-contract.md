# Contextual Resume Editing Contract

**Updated:** 2026-09-29. **Proposed implementation contract for the requested capabilities; no endpoints, components or migrations exist.** The user requests section-specific prompt assistance and resume-building/tailoring functionality. This document defines how to add those capabilities to F06/F08 while retaining the master-profile and privacy boundaries.

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

Basic creation copies supported professional facts into a draft without needing AI or a JD. `Resume.jdHistoryId` may be absent for this mode; `atsScore`/breakdown are absent rather than zero. A completed content status means a usable content version exists, not that scoring or export has occurred. JD-specific scoring requires a supplied JD. Selecting a new JD for tailoring does not overwrite the provenance of older versions.

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

| Method and relative route | Input / result | Permissions and scope |
|---|---|---|
| `POST /resumes` | Mode blank/profile-copy, profile association, template ID/version, optional JD → initial draft/version | `resume.create`, `profile.read`, `template.view`; authorized profile/workspace |
| `POST /resume/:id/suggestions` | Base version, expected revision, target, action, instruction, optional JD, idempotency → owned suggestion/run; 202 | `resume.read`, `resume.generate`, `resume.update` and input read access |
| `GET /resume/:id/suggestions/:suggestionId` | Private proposal/reasons/provenance/status | `resume.read` plus current target/input access; no raw provider payload |
| `POST /resume/:id/suggestions/:suggestionId/apply` | Expected revision + idempotency → one new version | `resume.read`, `resume.update` and current input/resource access |
| `POST /resume/:id/suggestions/:suggestionId/discard` | Expected suggestion state → terminal discard | `resume.update` and parent scope; cannot undo an already applied version |

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
