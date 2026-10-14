# Full-resume tailoring

## Connected personal workflow

Open a saved resume, choose Review, then Tailor to job and Tailor full resume. Paste the target JD and explicitly request Gemini suggestions. The dialog restores the latest stored run when reopened; closing it does not cancel work. Review each proposal, keep originals where needed, name the copy and choose Save tailored resume. Open the new copy to edit or download its saved PDF.

The saved source is the only candidate fact source in this slice. A master-profile read/import, newly confirmed facts, URL intake, DOCX output, cover letters, billing and application tracking are not connected here.

## Writing, grounding and scoring

Full tailoring uses the user-approved `gemini-3.8-flash` through the existing server REST adapter with medium thinking. Small selected-description rewrites and optional semantic JD analysis continue using `gemini-3.5-flash-lite`. The existing private `GEMINI_API_KEY` and `GEMINI_DATA_MODE=paid` settings are sufficient; no new SDK, key, service or database grant is needed.

- The writer sees the complete bounded visible professional fact bank: descriptions, achievements, role/project titles, listed skills and entry-local tools, with opaque field and entry-scope IDs. Header identity/contacts, employers, locations, dates, links, hidden content, raw source files and OAuth credentials are excluded. Contact-bearing professional prose and the known full identity are rejected before provider processing.
- The model plans against the JD and writes every professional field, including unchanged rows. An existing visible Summary can be filled or rewritten using relevant professional facts across entries. If import has no Summary section, add it in the editor first. Each experience/project field can use only its own entry's facts, never another job's achievements. Existing skills can be ranked but missing qualifications are not inserted. STAR/XYZ wording requires actual source context/results; an intended purpose cannot become an invented measured outcome.
- Server checks require complete field coverage, known unique evidence IDs, entry-local citations, original numbers, contact/identity exclusion, known technology support, preserved negative qualifiers, bullet/line boundaries and bounded length. A separate Gemini call checks supported meaning and whether every original responsibility, achievement and tool remains represented. Model judgments are fallible and still require human review.
- Rejected fields get one bounded correction pass and another independent review. Any wording still failing fact/detail checks retains its saved original, with a review warning. Unverified drafts never appear in public proposals or Apply. Provider/protocol failure fails the run without changing the source.
- The review shows source/proposed professional word counts, fields checked/rewritten, source citations and retained-original warnings. A source below 150 professional words gets guidance to add real responsibilities, tools and outcomes in the editor and save before tailoring again. There is no page-filling minimum or invented experience. New fact-intake/master merging remains follow-on work.
- Visible sections can move into summary, experience, projects, skills, education and languages order, putting professional evidence first. Existing project entries, achievements and skills may be ranked by supported JD terms. Every section/item remains present; hidden positions and work-entry chronology stay unchanged. Imported bullet-list structure remains a list after rewriting.
- Before/after comparisons use the same fixed local JD rubric and approved weights. Seniority and dated years remain evidence outside the score; incomplete dates produce unknown. This flow cannot guarantee 100/100, another ATS's judgment, interviews or an offer. Missing qualifications stay visible as gaps.
- Save recomputes readiness/JD results for the selected copy, including rejected proposals. Identity/contacts, dates, education content, templates and appearance copy unchanged. Source version and master profile remain untouched.

## Stored runs and limits

[Shared contracts](../packages/shared-types/src/tailoring.ts) validate inputs, operations and public states. [Use cases](../services/resume-service/src/tailoring/use-cases.ts) store private state in `Resume.atsBreakdown.tailoring`, reusing current restricted grants without a migration. [Writer grounding](../services/resume-service/src/tailoring/writer.ts) owns professional projection and validation.

Runs bind server-resolved owner/workspace, immutable source version ID, JD/fact/model/prompt fingerprint, expiry, progress, proposals and copy ID. `tailor-v2` records the approved full model, quality counts and warnings. Private draft/review payloads remain server-side and are cleared on completion, failure or cancellation. Old `tailor-v1` runs remain readable/applicable and execute their original Lite/line-validator path; they are not relabeled as the new model.

The worker executes one leased stage per tick: write, fact review, then only when necessary correction and final review. Progress reports two stages or four when correction is required. New runs use a 180-second lease, 120-second provider timeout, bounded 262,144-byte response and at most two simultaneous provider requests. Legacy runs keep their 60-second lease and existing adapter timeout. Abandoned stages can be reclaimed at most three times; explicit provider failures require a new request. Cancellation discards late responses. Access, actor expiry and source revision are rechecked before/after processing and at retrieval/Apply.

Limits: two active resumes per owner; one active run per source; 20 retained runs; 200 fields/60,000 professional prose characters plus at most 600 context facts/90,000 serialized fact characters; existing per-entry 30-field/12,000-character rewrite limits; 220,000-character provider payload; 30-minute expiry; 2,000,000-character retained metadata. This is a bounded local queue, not a commercial quota/cost ledger or distributed production worker. Full tailoring normally makes two model calls; a correction makes four, increasing token use.

Start is idempotent by request ID and input fingerprint. Apply accepts run ID, source version, selected operation IDs and copy name, never arbitrary replacement prose. Copy/version, source run marker and audit commit atomically. Duplicate Apply returns the same owned copy; differing replay choices conflict. Audit failure rolls back writes. Legacy generation/tailor/clone/Apply routes remain gated.

## API

- `GET /api/v1/resume/:id/tailoring`: latest owned run, current source version and provider availability.
- `POST /api/v1/resume/:id/tailoring`: `{ id, expectedVersion, jdText, consent: true }`; queues work, without synchronous provider calls.
- `POST /api/v1/resume/:id/tailoring/cancel`: `{ runId }`.
- `POST /api/v1/resume/:id/tailoring/apply`: `{ runId, expectedVersion, selectedIds, title }`; returns the independent saved resume.

Only these new owner routes were added to the personal service allowlist/gateway. Source IDs/workspace selectors never grant access.

## Manual checklist

1. From the repository root, run `pnpm db:local:start`, then `pnpm dev:personal`. Open `http://localhost:3000`. Keep this terminal running for hot reload. Set the existing private `.env` values `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `GEMINI_DATA_MODE=paid`; do not use `VITE_` secrets. [First-time native setup](../README.md#native-development) also initializes migrations/runtime credentials. Native and Docker databases are separate.
2. Sign in, upload a text resume, review fields and confirm save. Open Review, Tailor to job, Tailor full resume.
3. Paste a JD containing both supported and missing skills. Choose Create full-resume suggestions. Evidence should show source phrases, supported/missing terms, seniority and years uncertainty. Missing skills must never appear as candidate claims.
4. Close the dialog while drafting, then reopen it. Real stage progress/result should persist; fact-check correction may extend two stages to four. Test Cancel tailoring; cancelled runs must not offer Save. Start a fresh request to retry.
5. Confirm Gemini 3.8 Flash, source/proposed word counts and all professional fields checked. Read any retained-original/thin-source warning. Review removed/added text and expand full comparisons. Exclude a wording change and an ordering change; preview must retain originals. Check section/project/achievement/skill ordering without changing work chronology, dates, contacts or hidden positions.
6. Name the copy and choose Save tailored resume once. Open the copy, reload, verify selected changes and recalculated checks, then download PDF. Return to the source: its version and text must be unchanged. Repeated save of the same selection must not create another copy.
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
