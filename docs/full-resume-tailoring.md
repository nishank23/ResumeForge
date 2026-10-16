# Full-resume tailoring

## Connected personal workflow

Open a saved resume, choose Review, then Tailor to job and Tailor full resume. Paste the target JD and choose Find gaps and continue. Local rules assess the saved resume first. Optional details asks one relevant question at a time, with at most three suggested questions across the entire resume. Short entries receive priority, and entries with supported JD terms rank first. Skip any question, go back to edit, or choose Review added facts at any time. Detailed saved entries can proceed directly to confirmation without extra questions. Check the entry-linked answers and explicitly choose Confirm facts and tailor; Continue with saved facts is available when no answers are needed. The dialog restores the latest stored run when reopened; closing it does not cancel work. Review each proposal, keep originals where needed, name the copy and choose Save tailored resume. Open the new copy to edit or download its saved PDF.

The immutable saved source and explicitly user-confirmed professional answers are the candidate fact sources. Answers remain local to this dialog until confirmed for a run; closing before confirmation discards unsent answers. A master-profile read/import, URL intake, DOCX output, cover letters, billing and application tracking are not connected here.

## Writing, grounding and scoring

Full tailoring uses the user-approved `gemini-3.8-flash` through the existing server REST adapter. Initial drafting uses low thinking to reduce latency; independent fact/coverage review and the bounded correction use medium thinking. The model, factual guards, structured-output budgets and mandatory review are unchanged. Small selected-description rewrites and optional semantic JD analysis continue using `gemini-3.5-flash-lite`. The existing private `GEMINI_API_KEY` and `GEMINI_DATA_MODE=paid` settings are sufficient; no new SDK, key, service or database grant is needed.

- The writer sees the complete bounded visible professional fact bank: descriptions, achievements, role/project titles, listed skills and entry-local tools, with opaque field and entry-scope IDs. Header identity/contacts, employers, locations, dates, links, hidden content, raw source files and OAuth credentials are excluded. Contact-bearing professional prose and the known full identity are rejected before provider processing.
- The model plans against the JD and writes every professional field, including unchanged rows. An existing visible Summary can be filled or rewritten using relevant professional facts across entries. New v3 runs can propose a missing Summary as a separately selectable addition. Each experience/project field can use only its own entry's facts, never another job's achievements. Existing skills can be ranked. Explicitly confirmed tools can become separate reviewed entry-tool and Skills additions; JD requirements alone cannot authorize them. STAR/XYZ wording requires actual source context/results; an intended purpose cannot become an invented measured outcome.
- Server checks require complete field coverage, known unique evidence IDs, entry-local citations, original numbers, contact/identity exclusion, technology support, preserved negative qualifiers and bounded length. Descriptions with confirmed entry evidence can expand to distinct supported bullets; other description/achievement line boundaries remain unchanged. Additional facts cannot cross into another entry. A separate Gemini call checks supported meaning and whether every original responsibility, achievement and tool remains represented. Model judgments are fallible and still require human review.
- Rejected fields get one bounded correction pass and another independent review. Any wording still failing fact/detail checks retains its saved original, with a review warning. Unverified drafts never appear in public proposals or Apply. Provider/protocol failure fails the run without changing the source.
- The review shows source/proposed professional word counts, fields checked/rewritten, source citations and retained-original warnings. The optional questions cover contribution/problem context, actual tools and real outcomes/extra detail. A local heuristic omits tools already stated and outcomes already described; it does not make another model request or change scores. Suggestions are capped at three total, shown one at a time with Back/Skip/Next. Saved facts can bypass questions. Added details, including historical context/detail answers, remain editable in a collapsed disclosure and still appear in fact confirmation; users can also add a genuine detail to another visible entry. A thin source without additional facts still receives guidance. There is no page-filling minimum, invented experience or guaranteed 100 score. Master-profile merging remains follow-on work.
- Visible sections can move into summary, experience, projects, skills, education and languages order, putting professional evidence first. Existing project entries, achievements and skills may be ranked by supported JD terms. Every section/item remains present; hidden positions and work-entry chronology stay unchanged. Imported bullet-list structure remains a list after rewriting.
- Before/after comparisons use the same fixed local JD rubric and approved weights. Seniority and dated years remain evidence outside the score; incomplete dates produce unknown. This flow cannot guarantee 100/100, another ATS's judgment, interviews or an offer. Missing qualifications stay visible as gaps.
- Save recomputes readiness/JD results for the selected copy, including rejected proposals. Identity/contacts, dates, education content, templates and appearance copy unchanged. Source version and master profile remain untouched.

## Stored runs and limits

[Shared contracts](../packages/shared-types/src/tailoring.ts) validate inputs, operations and public states. [Use cases](../services/resume-service/src/tailoring/use-cases.ts) store private state in `Resume.atsBreakdown.tailoring`, reusing current restricted grants without a migration. [Writer grounding](../services/resume-service/src/tailoring/writer.ts) owns professional projection and validation.

Runs bind server-resolved owner/workspace, immutable source version ID, JD/fact/model/prompt fingerprint, expiry, progress, proposals and copy ID. `tailor-v3` also records `additionalFacts` with explicit confirmation, question kind and stable section/entry targets. Start validates visible professional targets and privacy before any provider call; the fingerprint includes the complete fact bank. Saved copies retain only facts cited by selected proposals in `tailoringOrigin.confirmedFacts`. User confirmation supplies asserted evidence, not independent verification of employment or credentials. Historical `tailor-v2` retains its saved-source writing/review path. Both record the approved full model, quality counts and warnings. Private draft/review payloads remain server-side and are cleared on completion, failure or cancellation. Old `tailor-v1` runs remain readable/applicable and execute their original Lite/line-validator path; they are not relabeled as the new model.

The worker executes one leased stage per tick: write, fact review, then only when necessary correction and final review. Progress reports two stages or four when correction is required. The browser refreshes its existing session grant before submitting a new queued run, preventing near-expiry tokens from failing during writing/review. Refresh failure, sign-out or identity changes prevent submission. Existing worker expiry/ownership checks still apply; this does not authorize processing beyond the grant lifetime. New runs use a 180-second lease, 120-second provider timeout, bounded 262,144-byte response and at most two simultaneous provider requests. Legacy v1 runs keep their 60-second lease and existing adapter timeout. Abandoned stages can be reclaimed at most three times; explicit provider failures require a new request. Cancellation discards late responses. Access, actor expiry and source revision are rechecked before/after processing and at retrieval/Apply.

Additional input limits: 30 unique answers, 2,000 characters per answer and 16,000 total. Tools answers use comma/semicolon/newline-separated names, at most 500 characters per entry and 60 per name. Confirmation is mandatory on every supplied fact. Exact app progress messages accidentally pasted as answers are rejected both before confirmation and before provider projection. This is a narrow input guard, not a general truth detector. Stored historical run schemas remain readable. No new provider, schema migration or runtime grant is added.

Limits: two active resumes per owner; one active run per source; 20 retained runs; 200 fields/60,000 professional prose characters plus at most 600 context facts/90,000 serialized fact characters; existing per-entry 30-field/12,000-character rewrite limits; 220,000-character provider payload; 30-minute expiry; 2,000,000-character retained metadata. This is a bounded local queue, not a commercial quota/cost ledger or distributed production worker. Full tailoring normally makes two model calls; a correction makes four, increasing token use.

Start is idempotent by request ID and input fingerprint. Apply accepts run ID, source version, selected operation IDs and copy name, never arbitrary replacement prose. Copy/version, source run marker and audit commit atomically. Duplicate Apply returns the same owned copy; differing replay choices conflict. Audit failure rolls back writes. Legacy generation/tailor/clone/Apply routes remain gated.

## API

- `GET /api/v1/resume/:id/tailoring`: latest owned run, current source version and provider availability.
- `POST /api/v1/resume/:id/tailoring`: `{ id, expectedVersion, jdText, consent: true, additionalFacts?: [{ sectionId, itemId, kind, text, confirmed: true }] }`; queues work, without synchronous provider calls. `kind` is contribution, tools, context, outcome or details. Old clients/runs default to no additional facts. All facts must target current visible experience/project entries.
- `POST /api/v1/resume/:id/tailoring/cancel`: `{ runId }`.
- `POST /api/v1/resume/:id/tailoring/apply`: `{ runId, expectedVersion, selectedIds, title }`; returns the independent saved resume.

Only these new owner routes were added to the personal service allowlist/gateway. Source IDs/workspace selectors never grant access.

## Manual checklist

1. From the repository root, run `pnpm db:local:start`, then `pnpm dev:personal`. Open `http://localhost:3000`. Keep this terminal running for hot reload. Set the existing private `.env` values `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `GEMINI_DATA_MODE=paid`; do not use `VITE_` secrets. [First-time native setup](../README.md#native-development-alternative) also initializes migrations/runtime credentials. Native and Docker databases are separate.
2. Sign in, upload a text resume, review fields and confirm save. Open Review, Tailor to job, Tailor full resume.
3. Paste a JD containing both supported and missing skills. Choose Find gaps and continue. Optional details shows one question at a time, at most three total; rich saved evidence may skip this stage. Test Back, Skip question and Next question; earlier answers must remain unless explicitly skipped or removed. Review added facts is available without completing every question. Expand Added details to edit earlier context/detail answers, or Add another detail for a genuine missing fact. A copied loading message must show an error before processing. Review entry-linked answers and choose Confirm facts and tailor; with no answers use Tailor with saved facts. Opening/editing questions must not call Gemini. Missing skills stay gaps unless supported by truthful confirmed evidence. Tool and summary additions remain independently rejectable proposals.
4. Close the dialog while drafting, then reopen it. Real stage progress/result should persist without repeating the entire fact ledger; visible stage copy must update when writing changes to review; fact-check correction may extend two stages to four. Test Cancel tailoring; cancelled runs must not offer Save. Start a fresh request to retry.
5. Confirm Gemini 3.8 Flash, source/proposed word counts and all professional fields checked. Read any retained-original/thin-source warning. Review removed/added text and expand full comparisons. Exclude a wording change and an ordering change; preview must retain originals. Check section/project/achievement/skill ordering without changing work chronology, dates, contacts or hidden positions.
6. Name the copy and choose Save tailored resume once. Open the copy, reload, verify selected changes and recalculated checks, then download PDF. Return to the source: its version and text must be unchanged. Repeated save of the same selection must not create another copy. Reopen the original, return to Job description and recheck the JD: the worksheet must remain open instead of jumping back to Export when the stored saved run refreshes.
7. In another tab, change/save the source while suggestions are pending/ready. The old Apply must fail; use the latest source for a new request. Unsaved edits block starting/saving from the current editor.
8. Use the full CV rather than the short synthetic test resume. Check every job, project, education entry, skill and language survives. Missing JD tools must not become candidate claims; a shorter source cannot produce a detailed full page honestly.
9. Check keyboard Tab/Escape/focus return, a narrow viewport, light/dark theme and reduced motion. Review content and footer actions must remain reachable without horizontal clipping.

## Local browser schema mismatch

A tab opened before shared-contract changes can retain the older frontend validator. If it rejects `model`, `promptVersion`, `quality` or `warnings`, reload the page using Cmd+Shift+R on macOS or Ctrl+Shift+R on Windows, then reopen Tailor full resume. The latest stored run restores its JD and ready proposals; do not submit another paid generation merely to repair the tab. A fresh tab can verify that the server result is valid before changing credentials or restarting services.

Current client response parsing remains strict and rejects unknown/malformed fields. Schema failures show a safe refresh message rather than raw Zod issue JSON. No automatic reload is used, so unsaved editor/JD input is not silently discarded.

## Automated checks

Run these from the repository root after installing dependencies:

```sh
pnpm --filter @resume-forge/shared-types build
pnpm --filter @resume-forge/resume-service build
pnpm --filter @resume-forge/gateway build
pnpm --filter @resume-forge/resume-service test
pnpm --filter @resume-forge/resume-service test:tailoring
pnpm --filter @resume-forge/resume-service test:editor:db
pnpm --filter @resume-forge/resume-mfe test
pnpm --filter @resume-forge/gateway test
pnpm --filter @resume-forge/resume-mfe build
pnpm --filter @resume-forge/resume-service lint
pnpm --filter @resume-forge/resume-mfe lint
```

Database tests use a disposable synthetic database and restricted role on the managed native cluster. They preserve the application database. Provider mocks test lifecycle/grounding failure paths; live browser tests separately exercise configured Gemini. Current results are recorded in [progress](../context/progress-tracker.md), not inferred from historical tests.

## Optional-details interaction

Reuse Sora headings, DM Sans body text and Forge semantic tokens: carbon #111014, panel #1b1921, dark violet #b89aff, mist #f5f3f8, paper #ffffff and light violet #6631c2. Keep a focused single question, its role/project title and optional reason. Collapse saved excerpts and added answers so they do not compete with the current input. Manual extra details reuse the same input and exact entry target. A separate grouped ledger supplies the explicit confirmation boundary.

Question navigation restores focus to its heading. On narrow screens, wrap actions and keep the footer and scrollable body reachable. Preserve shared Prompt/Dialog/Button controls and reduced-motion behavior. Processing shows actual queue/writing/review/correction state without the editable questionnaire or full confirmation ledger. No artificial delay, invented progress percentage, extra provider call or decorative redesign is added.
