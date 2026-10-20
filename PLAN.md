# Forge Studio Product Roadmap

Updated 2026-10-15. **The first Phase 1 slice is approved and implemented as a bounded personal workflow.** This roadmap distinguishes that delivery from follow-on intake/export work and later commercial phases.

## Product goal

Help a job seeker understand a target role, identify supported strengths and genuine gaps, create a reviewed tailored resume, and export an application. A later personal tracker records the user's applications and outcomes. Scores measure our own rubric; the product cannot predict employer ATS decisions, interviews or offers.

Initial delivery focuses on the individual resume workflow. Shared-workspace features require their own access controls and privacy checks before release.

## What already exists

| Capability | Current source and boundary | Work still required |
| --- | --- | --- |
| Sessions and saved resumes | [Auth](services/auth-service/src/app.ts), [resume use cases](services/resume-service/src/resume.ts): Google sign-in, owned library, immutable saves, delete/undo and current saved PDF. | Hosted/distributed session setup and commercial release checks. |
| JD analysis and scores | [JD parser](services/resume-service/src/jd-parser.ts), [JD scorer](packages/resume-core/src/jd-scoring.ts), [active ATS use cases](services/resume-service/src/ats/use-cases.ts). Fixed rules plus optional Gemini evidence. | Structured required/preferred skills, soft-skill evidence, seniority/years analysis, profile-versus-resume gaps and calibration. |
| AI rewriting and full tailoring | [Gemini adapter](services/resume-service/src/ats/ai.ts), [batch use cases](services/resume-service/src/tailoring/use-cases.ts): selected saved fields plus Gemini 3.8 Flash whole-source writing, independent fact/coverage review, bounded correction, supported ordering and copy-save. | Synthetic calibration, reviewed master-profile facts and commercial usage/cost limits. |
| Profile and import | [Profile API](services/profile-service/src/profile.ts), [file import](services/resume-service/src/upload.ts): optional basic profile UI, professional section APIs, reviewed PDF/DOCX/TXT/Markdown resume import. | Full profile-section UI and explicit reviewed master-profile import/export. Upload currently does not populate the master profile. |
| Clone/generation/history | Legacy handlers exist in [resume use cases](services/resume-service/src/resume.ts). | Safe contracts, gateway/runtime integration and UI. Legacy `tailorResume` scores an existing resume; it is not an AI full-resume rewrite. Do not enable legacy routes wholesale. |
| Cover letters, outreach, billing and personal job tracker | No active product flow or corresponding persisted subscription/application/cover-letter models. See [schema](packages/prisma-client/prisma/schema.prisma). | Build the proposed phases below. User-confirmed plan approval still precedes implementation. |
| URL JD intake, DOCX output and actual exported-file checks | Paste JD and saved PDF output exist. | Supported URL intake with paste fallback, DOCX rendering and parser round-trip checks. DOCX import is not DOCX export. |

## Product principles and decisions

- Never fabricate tools, ownership, seniority, employers, certifications, outcomes or numbers. Rewriting `Worked on backend API` cannot invent Node.js, PostgreSQL or a 35% reduction. If impact is missing, request a real detail or retain an unquantified contribution. STAR/XYZ describes supported facts, not invented results.
- The legacy [suggestion engine](services/resume-service/src/suggestion-engine.ts) now preserves text when no verified metric exists. Legacy suggestions/Apply remain gated; the full-tailoring flow uses separately validated server proposals.
- Job-description wording is observable; an employer's hidden ATS filters are not. Label requirement/keyword evidence honestly. Repeated keyword stuffing must not raise the score.
- Continue the existing paid Gemini adapter. Do not restore OpenCode or add an SDK/provider merely because the draft blueprint mentions one. [Google documents JSON Schema output](https://ai.google.dev/gemini-api/docs/structured-output); schema-valid text still requires our own factual validation and review.
- Preserve the approved readiness weights (25/25/20/15/15) and JD weights (30/25/20/15/10) initially. New seniority/confidence findings are separate evidence until a versioned replacement rubric is reviewed and calibrated.
- Decide a single payment provider and final prices later. The draft proposes both $15 and $12 per month. Measure tokens, retries and full-tailor cost before promising unlimited usage; consult [current Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Phase 1: Grounded full-resume tailoring

### First end-to-end slice

1. Select an owned, saved resume and paste a JD. A master profile is optional, preserving resume-first entry. Additional professional facts must be explicitly confirmed before use.
2. Extract role/title, hard and soft skills, stack, required/preferred requirements, stated years and seniority. Show source phrases and uncertain fields. Treat imported/JD text as untrusted data.
3. Compare saved evidence with the JD. Separate represented strengths, supported facts omitted from the resume, and genuinely missing qualifications. Identify whether evidence comes from the saved resume, a confirmed master profile or both; do not imply master coverage when no profile exists. A match score never authorizes inserting a missing skill.
4. Explicitly request whole-source summary/experience/project writing and relevant ordering proposals with the approved Gemini 3.8 Flash. Check fact support and original detail coverage independently; correct once, then retain any rejected originals. Retain stable targets and supporting fact IDs; do not change chronology into a misleading work history.
5. Show removed text with strikethrough and additions beside it, with complete original/proposed text and reasons. Users may reject individual proposals. Unsupported claims fail validation and cannot be accepted as AI output.
6. **Save tailored resume** creates an independent copy after review. Keep the source version and master profile unchanged. Recheck ownership, source/profile revisions, proposal expiry and idempotency in one atomic save/audit transaction.
7. Recompute the same readiness/JD rubric on the saved copy and download its PDF. Provider failure, cancellation, stale input or duplicate Apply must leave the source intact.

### Architecture and persisted contracts

Reuse shell/resume MFE, gateway, profile-service, resume-service, pure resume-core and the existing Gemini adapter. No new ai-copilot-service or MFE is needed for this slice. An eventual separate worker/service needs a lifecycle or scaling reason.

Read optional master facts through an authorized professional-only profile-service snapshot contract. Do not grant resume-service broad access to profile/contact tables or trust browser-supplied facts as saved master evidence.

The first slice stores owned runs in Resume.atsBreakdown.tailoring, using existing restricted runtime grants. Each run binds a server-resolved actor/workspace, immutable source version, JD/fact/model/prompt fingerprint and stored proposals. The local worker leases one batch at a time, restores abandoned leases, and rechecks access at execution, Apply and retrieval. Apply accepts proposal IDs and selections, never client-authored replacement text. Optional profile snapshots and dedicated task-table orchestration remain follow-on work.

Whole-resume work needs durable owned progress with bounded concurrency, token/cost budgets, idempotent start/Apply, cancellation, retry and expiry. Prefer an existing-database-backed task worker initially; choose external orchestration only if lifecycle requirements justify it. Never show invented completion percentages.

Professional fact projections exclude personal identity/contact fields, source files and OAuth credentials. Contacts are copied/rendered separately under existing owner permissions. Newly supplied facts remain resume-local unless the user explicitly chooses a reviewed master-profile merge. Keep provider processing scope visible.

### Follow-on intake and export

- Add reviewed professional master-profile section forms/import/export. LinkedIn-exported text PDFs use the existing intake pipeline; extraction confidence, field mapping and explicit merge are new work. This does not promise LinkedIn OAuth/API import or universal PDF/OCR support.
- Add URL intake progressively for supported public pages. Validate scheme, resolved IPs, redirects, content type/size and timeout; prevent access to internal services. Unavailable or restricted LinkedIn/Indeed pages fall back to Paste JD; no authenticated scraping.
- Add DOCX export from the same saved content/template contract. Extend actual PDF/DOCX extraction checks for reading order, supported text, Unicode and page breaks. Keep readability separate from job relevance; describe this as internal compatibility testing.
- Build a synthetic evaluation corpus across roles, career lengths and layouts. Measure JD extraction accuracy, unsupported-claim rejection, useful rewrites and score stability before changing weights or claiming parity with another platform.

### Acceptance before Phase 2

The full sign-in, source selection, JD analysis, diff/reject, save-copy, reload and PDF path must work. Test unrelated/empty JDs, duplicate/overlapping dates, missing evidence, prompt injection, new numeric claims, hidden/contact exclusions, stale inputs, cross-owner IDs, duplicate Apply, provider timeout and cancellation. Test long resumes, mobile, keyboard and reduced motion. Record actual commands/results; historical tests are not new release evidence.

## Phase 2: Personal job tracker and fact-library completion

Persist a JobApplication linking the owned JD, exact tailored resume version and later optional cover letter. Start with user-managed Wishlist, Applied, Interviewing, Offered and Rejected states, notes, dates and an accessible list alongside Kanban. No employer applicant pipeline, interview scheduling or automated submissions.

Complete reviewed profile import/export and reusable confirmed strengths if not finished in Phase 1 follow-on work. Define contacts separately, provenance, duplicate/conflict review and explicit master merges. Gate shared organization/vendor access on its existing permission, consent, runtime and audit repairs.

## Phase 3: Commercial accounts, billing and production readiness

Choose one provider (Stripe, LemonSqueezy or Polar) after checking account/country eligibility and checkout needs. Proposed schema: Subscription, immutable UsageLedger and deduplicated payment events; UserTier is derived from verified entitlements. Keep payment ownership separate from OAuth/session credentials.

Enforce quotas server-side before AI work. Reserve/settle/refund credits idempotently for retries/failures. A free base-resume limit must allow the reviewed tailored-copy workflow; count base resumes and tailoring usage separately. Final free credits, monthly price, paid allowance and overage policy remain decisions, not approved defaults.

Verify signed webhooks, event replay/order, cancellation/downgrade, payment failure and renewal. Before public paid launch, complete hosted sessions/service identity, backups/restore, retention/deletion, privacy disclosures, operational monitoring and cost limits. Local Docker packaging is not production readiness.

## Phase 4: Cover letters and recruiter message drafts

Generate editable cover-letter and LinkedIn/recruiter message drafts using the chosen JD and supported facts. Persist CoverLetter against exact JD/resume versions and record model/provenance. Define the currently reserved cover-letter permissions before activating routes or artifacts.

Reuse reviewed proposal/Apply semantics. No fabricated connection, recruiter identity, referral or company research. The user reviews/copies/sends drafts; automatic outreach and messaging tools are outside this request.

## Approved UI direction

Retain Forge Studio's violet identity, existing ASCII sign-in scene and original printable templates. New tailoring work is an evidence workspace, with a single stage navigator and a quiet source/changes comparison. Avoid adding another marketing hero or duplicate JD match entry point.

Named dark tokens: carbon `#111014`, panel `#1b1921`, violet `#b89aff`. Light tokens: mist `#f5f3f8`, paper `#ffffff`, violet `#6631c2`. Use existing semantic borders/text tokens rather than adding a second palette. Sora supplies headings/actions; DM Sans supplies body/forms; document fonts remain independent.

```text
Tailor to a job                       Saved source: Product resume v3
Job description   Evidence   Review   Export

Job description                    Source resume
[ Paste role and responsibilities ] [ Select saved resume          ]
[ Analyze job ]                     Current facts and save status

Review: selected changes             Resume preview
Summary / Experience / Projects     White document; proposed wording
Original and proposed text          Unchanged content stays readable
Supporting facts and reason
[ Save tailored resume ]
```

Left-align reading/forms; align score labels with their source evidence. Desktop uses an inspector beside the preview; mobile uses the same stages with a review sheet and full-text comparison. Buttons name outcomes: Analyze job, Create suggestions, Save tailored resume, Download PDF.

Reuse Performative Prompt/AssessmentMeter, shared buttons/dialogs/popovers and validated-response playback. Decorative motion cannot delay review or enter exports. Task status follows real persisted stages; page/navigation loads keep generic workspace copy. Preserve focus return, accessible status, device theme and reduced motion.

Design review: the evidence-and-change comparison is the distinctive element. Keep the surrounding layout restrained instead of repeating score cards or glowing controls. This plan deliberately preserves the approved product identity; a separate color redesign is not required.

## Delivery and next action

The saved-resume + pasted-JD slice now includes optional, explicitly confirmed entry-local experience answers and reviewed summary/tool/skill additions. It is connected: requirements/gaps and dated-years evidence, whole-source Gemini 3.8 Flash writing and independent review/correction, synthesized supported summary and section/project/achievement/skill ordering, per-proposal review, separate-copy save, recalculated checks and saved PDF. Source dates, identity, contacts, hidden content and master profile remain unchanged. Scores use the same local rubric before/after; this flow does not claim full master-profile coverage or employer ATS equivalence.

Guided, user-confirmed experience details are now part of tailoring. Next: calibrate extraction and writing across a synthetic role corpus, then add reviewed master-profile intake and DOCX/export compatibility checks. URL intake, tracker, billing and outreach follow their own phases. See the [tailoring contract and manual checklist](docs/full-resume-tailoring.md) for limits and verification.


## Proposed vendor extension

The vendor architecture is a follow-on proposal, not an active hiring workflow or approval to expose shared data. First finish personal tailoring calibration and import/export fidelity. The current three-question worksheet is optional; users can tailor using saved evidence without completing every entry. Keep fact confirmation and proposal review.

The existing Vendor/WorkspaceType schema, permission catalog, bounded PDF/DOCX parsing workers, server PDF renderer and personal audit outbox provide useful seams. They do not provide VendorCandidate, ClientSubmission, bench ranking, blind exports or client share links. Current vector retrieval is restricted to one owned resume/version, not a bench index. Audit payload hashes detect conflicting retries; they do not establish a tamper-evident event chain.

Recommended order after the personal quality gate:

1. Resolve vendor roles, candidate ownership/consent and contact/output permissions. Test restricted views across APIs, versions, PDFs, tasks and retrieval before activating shared access. Candidate contact and vendor internal rates require distinct field policies.
2. Add a small bench directory: VendorCandidate, explicit availability/status, skills, authorized candidate/resume linkage and restricted internal rates. Reuse the existing workspace/service boundaries; a new service is not required by the model names alone.
3. Add pasted-JD bench matching with permission-filtered retrieval, evidence-linked rankings, genuine gaps and recruiter review. Reuse grounded tailoring to create separate candidate-specific copies. Ranking never supplies missing qualifications.
4. Add server-produced blind/branded PDF variants with vendor recruiter details and explicit source/version/template/privacy identity. Redact protected contact values from headers, free text, links, document metadata and historical artifacts; visual hiding is insufficient.
5. Add ClientSubmission and manually created expiring, revocable links backed by hashed tokens. Recheck current access and allowed artifact variant. Use private object storage with retention/deletion and authorized short-lived downloads when needed; caching and backup are separate concerns.
6. Add bulk intake scheduling, per-tenant quotas/backpressure, retry/recovery and private artifact lifecycle when the single-candidate workflow is verified. Extend submission/export/link-access audit coverage; separately design tamper evidence and external verification rather than labeling the outbox alone tamper-evident.

These steps leave tracker, billing, outreach, URL ingestion and DOCX output as separate product decisions. No vendor routes, tables, grants, provider or storage dependency are activated by this assessment.
