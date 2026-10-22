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

[PLAN.md](../PLAN.md)'s first slice now uses version-bound professional facts, JD evidence, Gemini 3.8 Flash writing, independent fact/coverage review, one bounded correction pass and stored proposals, individual rejection and reviewed creation of a separate tailored resume. [Contract and manual checklist](../docs/full-resume-tailoring.md). Access/source revision/expiry checks, idempotent start/Apply, leased progress and cancellation are connected. User-confirmed, resume-local experience answers are now supported. They bind to the saved source version and original visible entry, require confirmation before Gemini processing, and never modify the source or master profile. Intake selects at most three relevant questions across the resume and shows one at a time; answering is optional. New browser submissions refresh the existing authorization grant first while worker expiry checks remain enforced. Missing summaries and confirmed tools/skills are separate selectable additions. Optional master-profile facts and commercial cost ledgers remain unimplemented.

Legacy quantify no longer fabricates numeric claims; other legacy suggestions/client-authoritative Apply remain gated. Missing JD qualifications are gaps, not facts to inject. New metrics require confirmed evidence. Tailoring preserves source/master content and honest chronology. Master merges require a separate explicit user action.

Check keyboard/focus restoration, mobile review, quiet motion, stale targets, cross-owner denial and source/contact exclusion. Application decoration never enters paper, PDFs or other exports.

New import heuristics separate supported undated project headings and map degree-first education; existing saved versions are never reparsed or rewritten automatically. Full-tailoring prose fields identify standalone achievements. Added descriptions must remain distinct from saved sibling text even when another proposal is rejected. Repetition failures use the existing bounded correction/original-retention path; source bullets are never removed to conceal duplication. Summary synthesis may intentionally repeat supported strengths. Exact line checks complement fallible semantic review, not a guarantee against every paraphrase.

## Save-before-action UX — 2026-10-20

Save & download exports the exact version returned by saving. Save & tailor waits for revision-bound owner callbacks and refuses to use an older snapshot if newer unsaved edits appeared during save. Conflicts/failures stop either follow-up. Tailoring has three presentation phases; optional added facts still require explicit confirmation before provider processing, and reviewed changes still save a separate copy. PDF retry does not repeat Apply. Compact readable editing changes only the view; saved appearance, exact A4 preview, paper identity and PDF rendering remain separate.

## Relevant-detail presentation — 2026-10-22

The writing workspace keeps task navigation and Preview in one toolbar. Structural and destructive actions remain available through labeled menus; deletion still requires confirmation and local Undo still restores it. Hover alone does not select content or reveal a toolbar. Explicit pointer/keyboard selection retains stable targets.

Full-tailoring review leads with proposed wording and a selectable change. Compare with original exposes full original/proposed text, rationale and evidence before saving. Copy naming and job-fit details are secondary; hiding the name field does not reset its controlled value or change Apply semantics. Warnings, errors, stale/expired blocks, fact confirmation and persistent copy-save/PDF actions remain visible when relevant. Extra-experience intake appears only after a usable JD. This changes presentation, not provider input, scoring or source/version authority.
