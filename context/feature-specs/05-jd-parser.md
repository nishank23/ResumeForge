# F05 — Job Description Parser

**Phase:** 2 — AI Pipeline · **Priority:** Critical · **Implementation:** Not started

## Goal and dependencies

Convert a user's supplied JD into structured tailoring input. Requires the Phase 1 personal profile/session foundation, AI provider configuration, and resume/JD persistence contracts. This creates JD history, not a job board.

## Ownership and planned files

`packages/resume-core/src/jd-parser.ts`, `packages/ai-provider/src/prompts/` and schemas, `services/resume-service/src/`, and `trigger/parse-jd.ts`. The parser takes bounded text and an injected provider; the service supplies authorization and persists JDHistory.

## Contract and workflow

Input: accessible profile reference plus raw JD text. Output: job title/company when present, keywords with category/required flag/source evidence, requirements, responsibilities, experience level, role type, and schema/model/prompt metadata. Preserve unknowns as absent/unknown instead of fabricating values.

1. Validate size, empty input, and scope before dispatch.
2. Treat JD text as data; ignore embedded instructions asking for secrets or changes to behavior.
3. Request structured output, validate it with Zod, and allow only bounded retry/repair attempts.
4. Persist raw and parsed content in the same workspace/profile scope; do not store a fabricated successful parse after failure.
5. Return sanitized progress/result identifiers and expose the parsed summary for review.

Keep raw JD out of ordinary logs. Embedding generation is an independent idempotent stage governed by D07; a missing embedding must not be misrepresented as a computed similarity score.

## Acceptance and verification

- [ ] Representative JDs produce schema-valid structured results grounded in their source text.
- [ ] Empty, oversized, malformed-output, provider-timeout, and adversarial JD cases are handled safely.
- [ ] A parse/result/run cannot be read or reused from another user's/workspace's scope.
- [ ] Retry does not create unintended duplicate JDHistory records for one idempotent request.
- [ ] Parser core has no workspace/auth/ORM dependencies; model-dependent checks are separated from deterministic schema tests.

No scraping, external job search, job publishing, or applicant ranking is included.

## Explicit JD context for prompts — 2026-09-29 planning update

A tailoring prompt uses the existing validated parser and a saved JD identity/revision. Basic builder mode omits the JD; it does not manufacture parsed input. Section rewriting may run without a JD for wording-only actions; Tailor to JD requires one. User intent is a separate bounded field from raw JD content.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] A missing or unrelated JD blocks JD-specific actions; a changed JD creates distinguishable provenance and cannot silently change an in-flight suggestion.
