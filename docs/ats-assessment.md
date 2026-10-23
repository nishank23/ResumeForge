# Evidence-based job fit — 2026-10-23

The user approved an owned ATS microservice using existing paid Gemini, with no new subscription. This replaces the active generic readiness and fixed-weight JD scores. It does not reproduce an employer's proprietary ATS algorithm or predict hiring outcomes.

## Assessment contract

`ats-evidence-v1` extracts distinct requirements from the actual pasted JD, including professional responsibilities, skills, experience, education, licenses and language requirements across professions. Explicit alternatives remain one requirement; repeated criteria must not earn repeated points. Gemini returns requirements, judgments and exact quotations, never numeric scores.

The service verifies each JD quote against the submitted JD and each evidence quote against its referenced visible professional source. Unknown sources, fabricated quotations, duplicated criteria, clearly negated evidence and empty extraction fail closed. A missing or ambiguous criterion receives no supported credit. Numeric coverage is `round(100 * supported mandatory requirements / mandatory requirements)`. When no mandatory requirements are identified, the score uses stated preferences and discloses that basis. No identified criteria means unavailable, never 100. Preferred coverage remains separate when mandatory requirements exist.

Word count, formatting, bullet count, bold text, action verbs, section count and contact presence do not affect this score. A list of skills cannot establish years of experience, leadership or professional licenses. Source assertions remain candidate-provided claims; exact quotations prove traceability, not truth. A single model pass can omit or misclassify requirements. This implementation has not been calibrated against employers or a representative resume corpus.

## Boundaries

- Browser: one Job fit panel; explicit Check job fit sends the JD and saved professional facts after visible scope disclosure. Opening the panel only reads saved results. Hover Improve with AI remains independent and unchanged.
- Gateway: forwards owned `/api/v1/resume/:id/ats-assessment` GET/POST to resume-service. ATS internal routes are not public proxy routes.
- Resume-service: authenticates the actor, authorizes `ats.view`/`ats.run` plus `resume.read`, selects an owned immutable version and excludes header/contact/source/hidden data. Contact-like professional text is rejected before egress. User-controlled source identifiers are hashed before they leave the owner service. It rechecks authorization before egress and publication, validates the service result and writes bounded metadata plus audit atomically under the existing resume lock.
- ATS service: stateless Hono process, private loopback port 4004, no database access. Bearer-protected POST `/internal/ats/assess`; protected GET `/internal/ats/health`. Existing `gemini-3.5-flash-lite` REST adapter, paid data mode required, no tools or automatic retries. Two active requests; 384,000-byte body cap; 60 sources, 60,000 total professional characters, 12,000 JD characters; default 45-second timeout.
- Cache/persistence: new `Resume.atsBreakdown.atsAssessments` history binds rubric, pinned model, source hash, JD hash, immutable version ID and version number. Changes require a new explicit assessment. At most 100 retained assessments and 2 MB aggregate metadata. No database schema migration. No provider fallback to legacy numeric scores.
- Tailoring: local parser terms may remain intake hints. New tailoring runs report null before/after legacy scores, and copies start without an assessment. Creating a tailored copy does not silently spend another Gemini assessment call.

## API

POST body: `{ expectedVersion, jdText, consent: true }`. GET and POST return the standard `{data,requestId}` envelope. `data` is `{ currentVersion, evaluation }`; evaluation is null or `{ id, resumeId, versionId, resumeVersion, inputHash, jdHash, evaluatedAt, assessment }`. Assessment is the shared `atsAssessmentSchema`. The response contains exact professional evidence but never credentials or contacts.

Historical readiness/JD records remain stored and readable. Their old POST routes now return authenticated `410 assessment_retired`, directing clients to Job fit. Existing source functions and strict legacy schemas remain for historical compatibility; they are not active score creation routes. The new UI does not display their scores.

## Configuration and deployment

`pnpm dev:personal` builds and starts the additional workspace service. Docker includes its manifest, build, private startup wait and health probe. No external port, new VM, database or subscription is needed. The existing cloud resource limit is unchanged; production memory must still be measured before claiming capacity on the 1 GB VM.

The ATS service reads existing private `.env`/`.local/ai-provider.env` paid Gemini settings and `.local/auth-transport.env`. Default internal key is HMAC-SHA256 of the existing service key with context `ats-service-v1`; optional `ATS_SERVICE_KEY` replaces it for both processes. Keys remain server-side and are neither returned to the UI nor committed. Only resume-service and ATS service receive Gemini process credentials. No `.env` file is uploaded through Git. Deployment requires the normal reviewed release process; feature-branch verification is not live-site proof.

## Public-tool investigation

The investigation compared public behavior and documented APIs, not private algorithms. No third-party account, subscription or private resume upload was created.

| Target                | Observed evidence                                                                                                                                                   | Boundary                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Jobscan public widget | REA `ev_c00e197cc74d8a4428100b53eb3bc12587a0a61dc01525ab0e2e78b6ac0a9408`: fresh bounded browser reached verification screen                                        | No scorer submission or private algorithm observed; verification was not bypassed                            |
| Affinda free parser   | REA `ev_1582947039d47520e9903983f08fb43e17c82a0af9d096bd5a0cae6fa205ac6b`: public upload UI advertises PDF/DOCX/images, in-memory parsing and optional job matching | No file uploaded, no output/algorithm observed; public statements are not independent retention verification |
| Glassdoor             | Bounded public developer/documentation search found no documented public resume-scoring endpoint; legacy developer URL returned 404                                 | Does not prove that no private enterprise integration exists                                                 |

Official [Jobscan guidance](https://www.jobscan.co/jobscan-tutorial) separates JD match from general resume advice. Its private weights were not established. Documented commercial matching plans reviewed were [RChilli](https://www.rchilli.com/pricing) at $75/month for 500 credits and [Textkernel](https://www.textkernel.com/products-solutions/source-and-match/) starting at $99/month. Credits are not necessarily one full end-to-end assessment each. [Affinda pricing](https://www.affinda.com/resume-parser/pricing/) advertises $0.10/document parsing; equivalent matching pricing was not verified. Prices are the observed 2026-10-23 snapshot. The user selected the existing Gemini route after seeing these prices.

The new coverage formula and architecture are product design decisions, not recovered competitor code. Public investigation is answered for input/output concepts and pricing, partial for public scorer behavior, and unresolved for proprietary algorithms.

## Verification

Five live synthetic-only Gemini cases passed through the authenticated local service: supported Python 100, explicitly negated Python 0, RN license with missing BLS 50, Postgres/PostgreSQL synonym 100, and one year against a five-year requirement 0/uncertain. Observed request time was 1,053–1,581 ms for these small inputs; this is not production latency or broad calibration proof. The initial provider schema caused HTTP 400; removing nested provider-side `maxItems` fixed the request, while strict application limits remain. See [Google structured-output limitations](https://ai.google.dev/gemini-api/docs/structured-output#limitations).

Fresh synthetic tests cover evidence grounding, negation, synonyms, nursing licenses/certifications, missing requirements, duplication, empty criteria, provider failures, transport bounds, authentication, consent, ownership, version conflicts, cache binding and UI state. Live-provider results and final check counts are recorded in the current progress tracker. No real resume/contact fixture is committed. Employer ATS parity, production memory and live deployment remain separate proof requirements.
