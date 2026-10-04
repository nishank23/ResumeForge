# F07 — ATS Scoring and Breakdown

**Phase:** 2 — AI Pipeline · **Priority:** Critical · **Implementation:** Not started

## Goal and dependencies

Explain how a resume aligns with a supplied JD using a reproducible, versioned heuristic. Requires F05/F06 structured data. Resolve D09 before scoring implementation and D07 before semantic vectors. No score promises acceptance by external ATS products or a hiring outcome.

## Proposed five-component rubric (D09)

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
