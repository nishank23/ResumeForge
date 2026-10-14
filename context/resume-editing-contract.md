# Resume editing contract

## Current saved editor

An owned Resume stores a strict EditorDocument with stable section/entry/achievement/group/tag/language IDs, visibility, dates, rich text and appearance. The shared schema validates browser/service boundaries. Reviewed import creates an owned resume version; it never writes a master professional profile or UserContact.

Dialog Save modifies the local draft. Save changes persists captured content against expectedVersion, with one immutable version/current pointer/audit transaction. Later typing remains dirty. Conflicts preserve edits and require reload; Cancel restores the acknowledged document. Source/import text remains private and hidden behind a disabled UI flag.

The existing inline/editor actions operate on the selected stable target. Repeated entries and sections use separate order scopes. Reject impossible moves without a state/history change. Skills/languages use their validated dialog rather than AI toolbar actions. Contact/header fields are private manual fields and never AI targets.

## Current Gemini proposal contract

The explicit Improve with AI action uses only a clean saved Summary or selected experience/project description plus visible achievements. Opening/selecting does not submit. The labeled action and scope copy supply processing intent; no extra consent checkbox is required.

The server excludes contacts/identity, titles/dates/technologies as rewrite fields, source files and unrelated entries. Validate structure, allowed target IDs, factual vocabulary, metrics, negation and line identities. Conservative validation is not proof of semantic truth, so users review every accepted edit. Unsupported claims and malformed/truncated responses fail closed.

Store original/proposed fields, proposal ID, model/input hash, exact target, base version and expiry. Review shows strikethrough removals/adjacent additions and complete original/proposed text. Unchanged results require no Apply.

Apply accepts server proposal identity and expected version, reauthorizes, checks current hashes/expiry and atomically writes one saved version/audit event. Idempotent replay is bounded to the currently applied version. Stale proposals cannot overwrite newer edits. Cancel/provider failure leaves the resume and master profile unchanged. Prior scores/artifacts become stale by version identity.

For active request budgets, provider settings and detailed manual checks see [ATS workflow](../docs/ats-workflow.md). For routes/limits see [API reference](../docs/api-reference.md). Browser and PDF rendering remain separate, with owner-only artifact checks.

## Saved-source batch tailoring

[PLAN.md](../PLAN.md)'s first slice now uses version-bound professional facts, JD evidence, Gemini 3.8 Flash writing, independent fact/coverage review, one bounded correction pass and stored proposals, individual rejection and reviewed creation of a separate tailored resume. [Contract and manual checklist](../docs/full-resume-tailoring.md). Access/source revision/expiry checks, idempotent start/Apply, leased progress and cancellation are connected. Optional master facts and commercial cost ledgers remain unimplemented.

Legacy quantify no longer fabricates numeric claims; other legacy suggestions/client-authoritative Apply remain gated. Missing JD qualifications are gaps, not facts to inject. New metrics require confirmed evidence. Tailoring preserves source/master content and honest chronology. Master merges require a separate explicit user action.

Check keyboard/focus restoration, mobile review, quiet motion, stale targets, cross-owner denial and source/contact exclusion. Application decoration never enters paper, PDFs or other exports.
