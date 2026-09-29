# F17 — Keyword and Skill Gap Analysis

**Phase:** 5 — Advanced · **Priority:** Medium · **Implementation:** Not started

## Goal and dependencies

Explain supported matches and missing evidence between a profile/resume and a JD. Requires F05/F07 contracts, D07 compatible embeddings, and F14/F15 authorization/audit. This is guidance for truthful profile/resume improvement, not a mechanism to invent qualifications.

## Ownership and planned files

`packages/resume-core/src/gap-analyzer.ts`, shared SkillGapResult schema, AI provider/embedding adapters, resume-service analysis endpoint, and resume-MFE gap panel.

## Contract and workflow

Input: authorized profile or resume version plus scoped parsed JD. Output: exact/semantic matches with evidence, JD requirements missing from the selected resume but supported in the master profile, and requirements with no supporting profile evidence. Include input revisions, analysis/model version, confidence/uncertainty, and suggested user actions.

Compare like embedding spaces only. Exact keywords and explicit facts should remain inspectable even when semantic analysis is unavailable. Do not turn absence of evidence into a claim that the person lacks a skill; label it “not found in this profile.”

Suggestions to include existing supported experience can lead to an explicit resume edit/regeneration. Suggestions to add new profile facts require the user to supply/confirm those facts through the profile editor. Analysis itself never writes to the profile or resume.

## States

Handle no gaps, empty JD, incomplete profile, missing vectors, provider failure, stale inputs, and denied access. Store or cache results by tenant, input revisions, and model/rubric identity; do not share results across unrelated users.

## Acceptance and verification

- [ ] Results distinguish supported-but-omitted material from missing profile evidence.
- [ ] Synonyms, exact matches, misleading keyword stuffing, and unknown requirements have grounded explanations.
- [ ] Analysis causes no profile/resume mutation and exposes no protected contact data.
- [ ] Changed input invalidates results; incompatible/missing embeddings show accurate fallback states.
- [ ] Authorization and cross-workspace tests match REST policy; synthetic examples verify output schema/evidence.

No hiring recommendations, candidate ranking, or automatic insertion of unsupported skills is included.

## Gap-to-section actions — 2026-09-29 planning update

For supported-but-omitted evidence, offer an action that opens the appropriate F08 prompt with a stable target and selected JD. The user explicitly requests and reviews the suggestion. Missing evidence leads to factual profile review instead of automatic keyword insertion.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Gap actions preserve target/JD provenance and never modify content on click or introduce unsupported skills.
