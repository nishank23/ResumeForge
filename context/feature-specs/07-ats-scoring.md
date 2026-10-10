# F07 — ATS Scoring and Breakdown

## Current no-JD rule cards — 2026-10-09

The user requests guidance like the supplied no-JD CareerZenith screenshots. General readiness now presents 13 compact rule families for populated documents, preserving every exact entry action and per-check preference. Completed requires all instances to pass; mixed pending/dismissed entries remain independently restorable. New advice covers bullet volume, technologies, education, supported skill count, rich-text bold and essential contact presence. It is score-neutral; existing weights and weighted math are unchanged.

`readiness-v2` preserves readable v1 history and refreshes old rubrics on the same saved version. Raw contacts remain outside the core scorer/AI: the private adapter supplies only a presence boolean to general guidance. JD scoring/feedback is unchanged. shadcn-based shared controls and Tiptap remain the editor foundation; no new decorative dependency is introduced. [Contract and verification](../../docs/ats-workflow.md#no-jd-rule-guidance-and-compatibility--2026-10-09). Full F07 remains partial; the reference's hidden algorithm is unknown.


## Current vector evidence retrieval — 2026-10-09

Optional paid Gemini JD analysis uses current-version professional entry embeddings before correspondence analysis. Similarity supplies candidate selection only; validated quotes and exact retrieved targets feed the unchanged approved local rubric. Private cache reuse/invalidation and nullable backwards-compatible retrieval metadata are implemented. [Vector contract and verification](../../docs/resume-vector-search.md).

## ## Implemented JD slice — 2026-10-09

D09 JD weights 30/25/20/15/10 are user-approved. Local saved-version JD matching, optional paid Gemini evidence, private persisted assessments/preferences and exact-entry Fix are implemented. Missing criteria remain partial; stale evidence disables actions. Technology labels count for matching, not description quality. Full F07 remains incomplete: finite parser coverage, broader quality evaluation, PDF checks, shared roles, durable tasks and history browsing remain pending. Prior Textkernel/pending-JD sections below are historical. [Current workflow](../../docs/ats-workflow.md).

## Current compact checks and Gemini model — 2026-10-09

ATS presents at most five expandable areas while retaining all rule evidence and approved score weights. Tabs count areas, with individual check counts and exact-entry actions inside. JD result editing, breakdown and evidence collapse on completion. Paid gemini-3.5-flash-lite supplies source-validated responsibility evidence for experience/projects and a separate scoped rewrite operation. Both cached replay boundaries compare model identity. OpenCode and unused Textkernel runtime are removed. Full F07 quality/corpus and PDF verification remain pending. [Current workflow](../../docs/ats-workflow.md).

## Historical provider plan cancellation — 2026-10-09

The user withdrew Textkernel after its corporate-email signup barrier and asked about Gemini/Odoo. Textkernel signup, indexing and live integration are no longer planned. Retain the existing shared result contract; the unused adapter remains disabled. Gemini/local JD scoring is the recommended replacement direction, with no provider activation or new rubric approval. Gemini's free-tier personal-data restrictions require synthetic development or a permitted real-data mode. Odoo Online's free/Standard plans lack external API access and its Recruitment app serves employer applicant tracking, outside this project's resume-management scope. This documentation-only change does not enable JD scoring; the foundation status below is historical. [Current provider review](../../docs/ats-providers.md).

## Provider-neutral JD adapter foundation — 2026-10-09

The user selected Textkernel's 500-credit trial and confirmed the account has not been created. `services/resume-service/src/ats` implements one prepared-pair scoring port, central provider composition and a current Match V2 adapter. The `jd-match-v1` shared schema preserves version/input hashes, native/provider/method identity, bounded normalization and nullable criterion counts; failures are unavailable outcomes rather than invented zeros. Synthetic mocked-transport tests cover switching, input validation, single-document filtering, privacy of results, invalid responses and bounded failure paths.

This is not live JD scoring or full F07 completion. The adapter accepts internal pre-indexed opaque references; no browser route receives those references. Account/Match V2 entitlement, professional-data preparation, scoped remote bindings, durable index cleanup, authenticated/current-version use cases, evidence persistence and JD UI remain pending. No contact/profile/database/credential change is included. Provider-native Match V2 scoring is distinct from both general readiness and the unapproved custom D09 JD rubric below. [Scope, official source evidence and manual checks](../../docs/ats-providers.md).

## Implemented general readiness slice — 2026-10-09

The user approved no-JD readiness first on 2026-10-08: structure 25%, experience detail 25%, skills presentation 20%, achievement clarity 15%, date consistency 15%. `packages/resume-core/src/readiness.ts` implements `readiness-v1` as deterministic checks over visible professional fields. There is no AI call or JD requirement. The JD rubric below is now approved and its personal slice is connected; full F07 is incomplete.

Authenticated personal read/run/preference endpoints bind assessments to the current immutable saved resume version, retain prior evidence, reject stale writes and require sanitized transactional audit. Header/contacts, hidden fields, layout and extraction source are excluded by the service projection. Existing `ats.view`/`ats.run` policy names are used without new grants. Organization/vendor activation is not enabled.

The panel shows real component math and reasons, saved identity, stale status, Pending/Completed/Deleted feedback, manual Fix/View and persisted Dismiss/Restore. Dismiss never raises the score. Completed contains all satisfied checks, including initial passes; removing a target does not claim resolution. This supersedes the historical Completed-to-resolved mapping below. The saved editor opens ATS Score and automatically checks missing/outdated assessments. Manual edit candidates/local edits show an explicitly unsaved preview through the shared pure projection/scorer; no preview writes evidence. Fix includes live issue guidance and Go to field. Successful content saves trigger a version-bound check while the panel is visible (otherwise on reopening); failures preserve stale evidence and allow Retry. Scoring does not apply an edit or create a content version. Empty professional input yields 0; absent assessment remains Not evaluated. No external ATS rating, parsing guarantee, hiring prediction or grading threshold is supplied.

Checks and limits, including 100 feedback checks, 100 retained assessments, 2,000,000 metadata characters and current-version-only scoring, are documented in the [README](../../README.md#general-resume-readiness--2026-10-09). General math/privacy/auth/version acceptance is covered by synthetic core/client/service/database tests. JD keywords/relevance, vectors/providers, actual PDF checks, shared roles, durable jobs and historical assessment browsing remain pending. The historical sections below describe prior planned or placeholder stages.

**Phase:** 2 — AI Pipeline · **Priority:** Critical · **Implementation:** Personal readiness/JD scoring connected; paid Gemini scoped wording connected; full F07 partial

## Goal and dependencies

Explain how a resume aligns with a supplied JD using a reproducible, versioned heuristic. Requires F05/F06 structured data. Resolve D09 before scoring implementation and D07 before semantic vectors. No score promises acceptance by external ATS products or a hiring outcome.

## Approved five-component JD rubric (D09 — 2026-10-09)

The source requires five components but gives no names or weights. This draft proposes:

| Component | Weight | Evidence |
|---|---|---|
| Required keyword coverage | 30 | JD-required terms supported by resume/profile facts |
| Experience and responsibility relevance | 25 | Grounded match to requested responsibilities and seniority |
| Skills alignment | 20 | Supported direct/semantic skills matches; no fabricated additions |
| Completeness and structure | 15 | Required sections, consistent dates, clear organization |
| Readability and formatting | 10 | Template/text checks such as extractable text and clear headings |

Normalize component results to 0–100; total = sum(component score × weight) / 100. Persist weights, rubric version, evidence, warnings, and input content/JD hashes. Missing components produce an explicitly unavailable/partial result, never a deceptively complete zero or quietly renormalized score. Formatting before export is a template/content estimate; actual PDF checks belong to F09.

## Ownership and workflow

`packages/resume-core/src/ats-scorer.ts`, AI provider schemas if needed for grounded relevance judgments, `trigger/score-ats.ts`, resume-service endpoints, and resume-MFE breakdown UI. Use deterministic checks where possible; isolate non-deterministic model reasoning and record its version.

Authorize the version and JD, score that exact pair, and store the result tied to the version. A resume edit marks previous results stale until rescored. Score visibility requires `ats.view`; recomputation requires `ats.run`.

## Acceptance and verification

- [ ] Approved weights total 100 and component math is bounded and reproducible for fixed inputs.
- [ ] Each component shows evidence/reasons, input identity, and rubric version.
- [ ] Absent vectors, provider errors, empty sections, and stale scores are labeled accurately.
- [ ] Keyword stuffing or unsupported skills cannot be presented as truthful profile improvement.
- [ ] Score/read endpoints reject unrelated versions/JDs and denied roles.
- [ ] Golden synthetic examples cover strong/weak matches and component edge cases.

Recruitment ranking and cross-person candidate comparison are excluded. Detailed gap recommendations are F17.

## Actionable feedback with version freshness — 2026-09-29 planning update

Link supported feedback to the relevant stable section and prefill a proposed action in F08; clicking feedback does not submit or apply. Preserve D09’s versioned heuristic and avoid hiring verdicts. Basic drafts without a JD show JD scoring unavailable. Applied edits invalidate prior scores; detailed gap analysis remains F17.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Feedback targets the intended section/version, and scores never remain labeled current after content or JD changes.

## Issue lifecycle — U06

Store stable issue identity, rule/rubric version, source resume/JD version, target and supporting evidence. Use open/resolved/dismissed states: dismiss hides a recommendation without increasing the score; only re-evaluation against the new version can mark a rule resolved. Keep previous evaluations immutable and display their staleness. “Fix” navigates to manual editing or prefills a grounded suggestion; it never applies AI automatically. General structural feedback can appear without a JD but must not be labeled JD match scoring.

- [ ] Dismiss/reopen affects only the actor's feedback preference and cannot alter evidence or total score.
- [ ] Resolved status requires a newer evaluation; stale or deleted targets give a recoverable navigation state.

## Requested ATS panel — 2026-10-03

Use an **ATS Score** tool panel beside the document with **Readiness Rating**, **Suggested Actions** and counted **Pending / Completed / Deleted** tabs. Pending maps to `open`, Completed to `resolved`, Deleted to `dismissed`. Deleted is reversible recommendation dismissal, not resume deletion; it cannot improve the score. See the [frontend editor plan](../../docs/frontend-editor-plan.md) for Fix, View, Reason, Dismiss and Restore behavior.

- [ ] No-JD structural readiness is clearly distinct from JD matching; absent evaluation shows Not evaluated. D09 still gates rating rules/thresholds/weights; the reference's bars and counts are not our algorithm.
- [ ] Fix opens the target field/dialog/composer; View selects it and Reason exposes evidence. No automatic AI call or application.
- [ ] Counts/statuses use the current evaluation/preferences, support empty/stale/deleted-target recovery and re-evaluation, and are accessible without color.
- [ ] Completing a manual edit alone cannot mark a rule resolved; dismiss/restore preserve immutable evidence and score math.

UI fixtures may be explicitly synthetic; actual readiness/scoring and issue persistence are not implemented by this requirements update.

## Frontend meter implementation — 2026-10-08

The ATS tool panel now shows an original calibrated 0–100 scale with an unavailable score, Not evaluated status, disabled Run ATS check and honest action-filter empty states. This implements presentation only, without adding rating thresholds, rubric weights, counts, issue lifecycle or scoring calls. F07 acceptance remains incomplete until authenticated/version-bound evaluation and freshness handling are connected. [Frontend verification](../../README.md#editor-sidebar-ats-meter-and-section-actions--2026-10-08).
