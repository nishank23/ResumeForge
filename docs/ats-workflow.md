# ATS, JD matching and Gemini wording — 2026-10-09

## Explicit AI actions and inline review — 2026-10-10

This supersedes checkbox requirements in the earlier sections. The user requests removal of AI consent checkboxes. Clicking Improve with AI or Analyze/Recheck with Gemini selected supplies explicit processing intent; merely opening the panel does not call a provider. The existing `consent: true` request flag remains required for rewrite/semantic egress, preserving the API boundary and older clients. UI uses method buttons for JD. Scope copy remains accurate: only selected description/visible achievements reach rewrites; JD analysis uses visible professional entries/responsibilities and embeddings. Contacts and other entries are not rewrite inputs. Professional text may contain personal information; no broad non-personal-data claim is made.

New proposals use the shared prompt/validator grammar and explicit auth/authentication, singular app/application, plural apps/applications and whole-phrase UI/user interface equivalents. Singular/plural application terms remain separate; the UI expansion must be one adjacent phrase, not scattered words. Other source vocabulary, numbers, negative wording and slash-separated terms remain guarded. This resolves the reproduced harmless-word rejection without allowing arbitrary new technology/qualification words. Review shows bounded word-level deletions and insertions, with full texts expandable; Apply still uses only server-stored proposal ID and expected version. No scoring or provider-model change. [Verification/manual checks](../README.md#gemini-rewrite-repair-and-inline-review--2026-10-10).

## No-JD rule guidance and compatibility — 2026-10-09

`readiness-v2` extends general readiness with score-neutral advice while preserving all original weighted rules and 25/25/20/15/15 weights. New checks cover 2–6 visible bullets, explicit entry technologies, optional education completeness, at least five supported skills, bold over half a description of at least 120 characters, and essential contact presence. They carry `scored: false`; they never enter component totals or JD feedback. Imported PDF emphasis is not preserved, so bold checks describe editor rich text only.

The shared adapter derives a single `contactComplete` boolean from the private owner document. `resume-core` accepts that boolean separately from its professional projection; it never receives raw header/contact values. The readiness hash binds projection and presence hints. JD analysis, embeddings and rewriting receive no presence hints or header/contact values. Professional projection additionally retains explicit tools, visible bullet count and rich-text character/bold counts for local guidance.

The shared result schema accepts v1 and v2 histories. Run replay requires current saved version, input hash **and rubric version**. Older rubrics trigger automatic reevaluation without editing the immutable resume. Preferences for stale rubrics are rejected; new assessments retain the prior evaluation. All existing authorization, metadata limits, current-version checks, transactional audit and privacy boundaries remain.

The no-JD UI groups individual checks into 13 rule families on a populated document. Completed requires every family instance to pass. Per-entry Dismiss/Restore persists independently, so a mixed family can appear in Pending and Deleted. Every failed/dismissed entry remains navigable/restorable; no blanket rule dismissal or automatic edit occurs. JD feedback retains its existing five-area presentation. [Current checks and manual steps](../README.md#alternate-layout-import-and-no-jd-rule-cards--2026-10-09).


## Current scope

The user now selects paid Gemini for both semantic evaluation and wording changes, superseding the earlier OpenCode/MiMo choice. Numeric scores retain the approved deterministic rubrics. Individual owner workspaces only; full generation, durable jobs and shared-role activation remain pending.

## Models and configuration

`services/resume-service/src/ats/ai.ts` is the central injected provider boundary for semantic evidence, embeddings and scoped rewrites. Both generation operations pin **gemini-3.5-flash-lite**, stable July 2026, with minimal thinking, temperature 0, a 1,800-output-token cap for analysis and 8,192 for rewrites, structured JSON and no tools. [Google model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) and [current standard pricing](https://ai.google.dev/gemini-api/docs/pricing): $0.30 input / $2.50 output per million tokens, including thinking output (checked 2026-10-09). This is a low-cost current default, not a claim that model quality has been established across all resumes. No automatic expensive-model fallback or provider retry is implemented.

Keep `GEMINI_API_KEY` in the original project's ignored `.env`; set `GEMINI_DATA_MODE=paid` in ignored `.local/ai-provider.env`. Settings are server-only, never `VITE_*`. Explicit per-request AI action is required; UI consent checkboxes are removed. Paid mode is a deployment declaration; the application cannot independently verify account billing. [Paid-service terms](https://ai.google.dev/gemini-api/terms) govern provider handling.

OpenCode's SDK, native process/session adapter, HTTP adapter and dependency were removed. The unused Textkernel configuration, prepared-reference platform runtime and vendor tests were removed after confirming no application consumers. The legacy public `jd-match-v1` result schema remains readable for compatibility. Historical MiMo proposals remain accepted by the stored proposal schema; new proposals are Gemini-only. Existing local OpenCode installations/credentials are not altered. Obsolete OpenCode mode/binary flags are no longer read by this application.

Embeddings retain **gemini-embedding-001**, 768 dimensions, professional-v1 projection. The model space and private vector lifecycle do not change with the text model. [Vector contract](resume-vector-search.md).

## Scoring and evidence

General `readiness-v1` uses structure 25%, experience detail 25%, skills presentation 20%, achievement clarity 15% and date consistency 15%. It requires no JD or provider. The pure scorer still evaluates every rule; presentation groups them into at most five areas rather than dozens of cards. Tabs count areas, with the exact check count underneath. Expand an area for the original stable rule, reason, Fix/View and Dismiss/Restore. Dismissal remains score-neutral.

Pure `jd-local-v1` retains required keywords 30%, experience relevance 25%, skills 20%, structure 15% and readability 10%. Keyword/skill support uses explicit boundaries and aliases, including entry technology labels. Experience/project relevance uses term overlap or source-validated Gemini correspondence. Gemini receives only JD responsibilities and retrieved visible professional experience/project details, returns exact requirement/evidence quotes and stable entry IDs, and never supplies numeric scores. Similarity alone earns no points. Contacts, hidden fields, extraction source and appearance are excluded; contact-like professional/JD text blocks external processing.

The parser has a finite technology-oriented vocabulary and heading heuristics. Gemini does not discover arbitrary new skill criteria. Missing criteria produce partial scores without silently redistributing weights. Exact quotes validate grounding, not factual truth or the semantic correctness of a judgment. A readiness score of 100 means basic rules passed, not strong job suitability or PDF parseability.

`Resume.atsBreakdown.jdMatching` stores up to 100 immutable assessments with version/input/JD hashes, weights, evidence, method/model and timestamps. Both preflight and transactional replay checks bind the configured model, so an earlier Gemini model cannot suppress a fresh result. Unchanged latest version/JD/mode/model returns the stored assessment without another provider request. Resume embeddings can be reused when the text model changes. Metadata is bounded to 2,000,000 serialized characters.

## Scoped wording review and save

Only selected saved Summary or experience/project description and visible achievements are sent for rewriting. Titles, dates, technologies, links, contacts and other entries are not rewrite fields. AI cannot create missing experience. The output must preserve field IDs, source factual vocabulary and numeric claims; unsupported fields, duplicates, contacts, tools, malformed output or truncation fail closed. These conservative checks do not prove factual equivalence; user review remains required.

The server stores proposal ID, model, input hash, original/proposed text, stable target and immutable base version. Apply accepts only proposal ID and expected version, reauthorizes, enforces 30-minute expiry and grounding, and atomically saves one new version plus audit. Replay is idempotent while the applied version remains current. Stale suggestions cannot overwrite later changes. Cancel/provider failure preserves the resume and master profile. Contact-bearing header snapshots remain separate.

Generation HTTP is bounded to 20 seconds and embeddings to eight seconds, two active requests, 64 KiB generated response and 2 MB embeddings. Gateway JD/rewrite allows 60 seconds; PDF remains 30 seconds. No raw keys/provider responses or professional text enter error messages or audit metadata. Production cost controls and durable Trigger.dev jobs remain pending.

## Compact interface and manual verification

Forge colors remain #4338CA accent, #172033 ink, #536079 muted text, #EEF1F6 muted surfaces and white paper. System typography and existing dialogs are reused. The score leads; readiness breakdown/details and five feedback areas expand on demand. A completed JD collapses its editor, breakdown and evidence; exact-entry actions stay available. No animation or PDF design changes are introduced.

Follow [README manual steps](../README.md#setup-and-manual-checks). Automated checks and actual browser evidence are recorded in the [tracker](../context/progress-tracker.md). No real resume or credentials are committed as fixtures. The prior live OpenCode SDK returned 403 FreeTierError; its removed adapter is historical evidence, not a current setup requirement.
