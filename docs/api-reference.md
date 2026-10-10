# Planned API Reference

## AI processing actions — 2026-10-10

The UI's explicit Improve with AI / Gemini Analyze action supplies the existing processing-intent flag; consent checkboxes are removed. `POST /api/v1/resume/:id/ai-rewrite` still requires `expectedVersion`, stable `target`, and `consent: true`; the default frontend call supplies true only when invoked. The server selects saved field IDs/text and returns the stored proposal. JD semantic requests likewise require explicit true; local requests require no provider intent. Apply accepts proposal ID/version only. No route, response or permission schema change; old clients remain valid. [Action/review contract](ats-workflow.md#explicit-ai-actions-and-inline-review--2026-10-10).

## Current general-readiness compatibility — 2026-10-09

Existing readiness read/run/preference endpoints keep their actor/workspace/version contract. Responses accept v1/v2 history; new results use `readiness-v2`, with optional `scored: false` advice and private owner header targets. A run refreshes an older rubric on the same content version; replay also checks rubric identity. Preferences reject stale rubric/evaluation identity. Contact guidance contains only pass/fail and generic text, never raw values. JD scoring/feedback retains its existing rubric. [Current contract](ats-workflow.md#no-jd-rule-guidance-and-compatibility--2026-10-09).


## ## Personal JD and scoped AI routes — 2026-10-09

Authenticated GET/POST /api/v1/resume/:id/jd-match, PUT /:id/jd-match/preferences, POST /:id/ai-rewrite and POST /:id/ai-rewrite/apply are connected. Every mutation validates the expected saved version and existing owner/action scope. Rewrite apply receives only the stored proposal ID, never client-supplied replacement text. The optional JD assessment `retrieval` field adds model, dimensions (768), indexed/reused chunk counts and requirement/section/item/similarity candidates. Older responses remain valid. No public search endpoint is added. [Private retrieval contract](resume-vector-search.md). These routes do not activate legacy generation/tailoring or Textkernel. [Schemas, permissions, consent and limits](ats-workflow.md).

## Implemented personal general readiness — 2026-10-09

These are private owner-only personal editor routes, not the legacy JD scoring/generation routes. They use the existing actor/workspace resolution and `ats.view`/`ats.run` policy names. No organization/vendor activation is implied.

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/resume/:id/readiness` | Latest and preceding retained evaluation, current saved version, dismissed check IDs. An absent assessment is null, not 0. |
| POST | `/resume/:id/readiness` | Strict `{ expectedVersion }`. Scores only the current immutable saved editor snapshot. Same version/input replays the same result. |
| PUT | `/resume/:id/readiness/preferences` | Strict `{ expectedVersion, evaluationId, issueId, dismissed }`. Dismiss/restore only a failed check from the current evaluation. No score change. |

The normal `{ data, requestId }` envelope contains `{ currentVersion, evaluation, previous, dismissed }`. An evaluation includes UUID identity/resume/version IDs, positive resumeVersion, SHA-256 contact-free inputHash, evaluatedAt, mode `general`, rubricVersion `readiness-v1`, bounded integer score, five weighted component counts and up to 100 generic checks with stable optional section/entry targets. `truncated` reports feedback truncation; all checks contribute to math.

Strict validation rejects client-supplied scores/extra fields (422), stale versions/evaluation identities fail 409, missing/deleted/foreign resources fail 404, denied workspace fails 403, missing/expired actor fails 401 and infrastructure failure returns an unavailable error. Mutations share the resume advisory transaction lock with manual save/delete and require atomic sanitized audit. Responses are private/no-store. Existing role grants and schema remain unchanged. History/metadata limits fail visibly without deleting evidence. See [F07](../context/feature-specs/07-ats-scoring.md) and [README](../README.md#general-resume-readiness--2026-10-09).

**Mostly planned contracts.** Local Google/session endpoints, professional profile POST/GET/PUT, professional draft PUT, bounded personal editor routes described below, Experience GET/POST and entry PUT plus the internal audit/actor-resolution endpoints below are implemented; other routes remain planned. All external paths below are relative to one `/api/v1` prefix. This reconciles conflicting service headings in the source plan. Proposed additions are labeled and need contract review before implementation.

## JD provider result foundation — 2026-10-09

`packages/shared-types/src/jd-match.ts` defines browser-safe `jd-match-v1` outcomes for future JD use cases. `scored` carries mode `jd-match`, saved resume/version/snapshot and resume/JD input hashes, evaluation time, normalized score, provider/method/API/optional engine identity, native value/scale and nullable matched/unmatched/unknown criterion counts. `unavailable` carries an explicit sanitized failure code with no score. The schema rejects inconsistent normalization; vendor scores are not interchangeable calibrations or our proposed five-component rubric.

This is a server-internal adapter foundation, **not an enabled HTTP route**. The user withdrew Textkernel after its signup barrier; Gemini/local matching is being considered and no provider is active. Prepared remote references and credentials cannot be browser-supplied selectors. New authenticated/current-version orchestration, scope/provenance, remote indexing/cleanup, audit and persistence must be implemented before exposing a JD endpoint. Existing general readiness and legacy personal-editor route restrictions remain unchanged. [Provider guide](ats-providers.md).

## Shared rules

- Bearer/session authentication resolves the actor server-side. Proposed workspace selector: `X-Workspace-Id`; resolve type and membership from authoritative data. The shell's active workspace is not an authorization grant.
- For shared profile operations, an optional `profileId` query/body selector identifies a target; omission resolves the actor's profile. Resolve the selector under workspace/profile grants. Never treat the ID as sufficient authority.
- Proposed envelopes: `{ data, requestId }`; errors `{ error: { code, message, fieldErrors? }, requestId }`. Lists include a bounded `nextCursor`; use an allowlisted sort plus stable ID tie-breaker, default updated time+ID. Bind cursors to the query, sort and workspace.
- Use 401 for missing/invalid session, 403 for known denied capability, 404 for absent or deliberately concealed out-of-scope objects, 409 for revision/idempotency conflict, 422 for validated field errors, and 429 for rate limits. Do not reveal object existence through inconsistent errors.
- Mutation input cannot set actor, owner, role grants, score, task status, or object keys unless an explicit validated operation owns that field.
- Proposed `Idempotency-Key` for generation/import/export jobs; expected revision for profile/resume writes. A replay with different payload is a conflict.
- Background endpoints return 202 with owned resource/run identifiers and sanitized status; never leak another actor's Trigger.dev token or raw task output.

## Auth service

Implemented internal boundary (separate from `/api/v1`, never forwarded by the gateway): `POST /internal/auth/resolve`. Only the configured local profile-service caller may send a strict `{ accessToken }` body. Success contains `userId`, `personalWorkspaceId` and Unix-millisecond `expiresAt`; service keys/session credentials and private content are excluded. Session/scope invalidation returns 401; service/database failure returns fixed unavailable errors. Origin/CORS, body limits, no-cache behavior and consumer duties are detailed in [actor resolution](actor-resolution.md).

| Method | Path                      | Contract                                                                                                                                            |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/auth/google/url`        | Create a bound OAuth transaction; return authorized provider URL                                                                                    |
| GET    | `/auth/google/callback`   | Local Google redirect endpoint: validate bound single-use transaction, exchange code server-side, set refresh cookie and redirect to sign-in status |
| GET    | `/auth/linkedin/url`      | Equivalent LinkedIn initiation                                                                                                                      |
| POST   | `/auth/linkedin/callback` | Equivalent LinkedIn callback                                                                                                                        |
| POST   | `/auth/refresh`           | Rotate the current application refresh session                                                                                                      |
| POST   | `/auth/logout`            | Revoke the session and clear client credentials                                                                                                     |
| GET    | `/auth/me`                | Minimal identity/session summary; no raw provider data                                                                                              |

Google local redirect lands directly on auth-service port 4001; no authorization code is forwarded through the frontend. LinkedIn callback remains planned. Verify the actual provider configuration and supported scopes during F02. OAuth login does not imply full LinkedIn profile-import access. Session transport/cookies and account linking depend on D08/D10.

## Profile service

POST, GET and PUT `/profile` and PUT `/profile/draft` are implemented locally on profile-service port 4002. POST initializes a missing owned master from an explicit full name and optional nullable location/summary; no auth/provider facts are copied. It returns 201 at revision 1, or 409 `profile_exists` without overwriting/duplicating an existing master. GET/PUT operate only on an existing profile; normal PUT requires these three professional fields plus `expectedRevision`. Draft PUT requires at least one of those fields and `expectedRevision`, preserves omitted values and allows null clearing of location/summary during incomplete onboarding only. It shares the master's revision and never completes/reopens setup; completed onboarding returns 409 `onboarding_complete`. The professional DTO contains only `id`, `fullName`, nullable `location`, nullable `professionalSummary` and `revision`. No client profile/user ID, contacts, onboarding state or unknown fields are accepted. All query parameters are rejected. The optional workspace header is checked against verified ownership. Every use case resolves a fresh server actor, enforces action/scope and commits content-free audit capture before returning. Revision conflicts return 409; absent profiles return 404 without implicit creation. Work Experience GET/POST and entry PUT are also implemented under the same parent revision; see [its separate contract](experience-api.md). Entry deletion/reorder, other section/contact APIs, final setup and browser/gateway integration remain pending. See [profile contract and verification](profile-api.md).

| Method       | Path                          | Contract / permission                                                                                                   |
| ------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET          | `/profile`                    | Authorized professional DTO; `profile.read`; contact excluded by default                                                |
| POST         | `/profile`                    | Explicit professional initialization; `profile.create`; owned personal scope, 201 or existing-profile 409               |
| PUT          | `/profile`                    | Validate allowlisted professional fields + revision; `profile.update`                                                   |
| PUT          | `/profile/draft`              | Partial professional save on an existing incomplete master + revision; `profile.update`                                 |
| POST         | `/profile/setup`              | Validate and complete onboarding; own profile or expressly authorized creation                                          |
| GET / PUT    | `/profile/contact`            | Separate DTO/write schema; `profile.contact.read` / `profile.contact.update`                                            |
| GET / POST   | `/profile/education`          | List/create a scoped education row                                                                                      |
| PUT / DELETE | `/profile/education/:id`      | Update/delete via authorized parent profile                                                                             |
| GET / POST   | `/profile/experience`         | Implemented local owned list/add; contact-free DTO, shared parent revision and audit; `profile.read` / `profile.update` |
| PUT          | `/profile/experience/:id`     | Implemented local owned full-field replacement + parent revision; `profile.update`                                      |
| DELETE       | `/profile/experience/:id`     | Planned owned-entry deletion                                                                                            |
| GET / POST   | `/profile/skills`             | List/create skills                                                                                                      |
| PUT / DELETE | `/profile/skills/:id`         | Update/delete skills                                                                                                    |
| GET / POST   | `/profile/projects`           | List/create professional projects                                                                                       |
| PUT / DELETE | `/profile/projects/:id`       | Update/delete projects                                                                                                  |
| GET / POST   | `/profile/certifications`     | List/create certifications                                                                                              |
| PUT / DELETE | `/profile/certifications/:id` | Update/delete certifications                                                                                            |
| POST         | `/profile/import/linkedin`    | Phase 5: validate upload reference, create preview; proposed confirm endpoint below                                     |

Section reads require `profile.read`; section writes require `profile.update` on the parent. Local Experience GET/POST and entry PUT are implemented: bounded owned entries, append order, strict dates/plain bullets, parent revisions and atomic content-free audit. Entry deletion/reorder and other section/contact routes remain planned; see [Experience contract and verification](experience-api.md). Dedicated contact permissions cannot be bypassed through `/profile`, `/profile/draft`, `/profile/experience` or import. Draft PUT covers only the three professional master fields. Proposed additions: `DELETE /profile` for an approved profile-deletion lifecycle, `GET /profile/import/:id` for review, and `POST /profile/import/:id/confirm` for explicit merge. D03/D11 govern destructive/shared effects.

## Implemented personal editor routes — 2026-10-04

These routes are enabled through the loopback gateway and restricted personal resume runtime. Resolve the Bearer actor and recheck personal workspace ownership; `X-Workspace-Id` is only a selector. No shared workspace is accepted.

| Method | Path            | Current contract                                                                                                                                                                                                                                     |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/resume`       | At most 50 owned metadata rows ordered updatedAt/ID descending. Optional `?cursor=<owned resume UUID>`; use the last ID only for a full page. Lists are arrays, not the proposed nextCursor envelope. Concurrent updates have no snapshot guarantee. |
| POST   | `/resume`       | Strict `{id: UUID, content}` with matching title and non-synthetic editorDraft. Creates draft/version 1/audit atomically. An owned ID replay returns the original without reapplying input or duplicating audit.                                     |
| GET    | `/resume/:id`   | Owned current private content and version metadata.                                                                                                                                                                                                  |
| PUT    | `/resume/:id`   | Strict bounded content and expectedVersion; creates a new immutable version/audit atomically. Stale revision returns 409. Saved JSON retains editorDraft rich text/IDs/dates/visibility/languages/appearance.                                        |
| POST   | `/resume/parse` | Authenticated local PDF/DOCX/TXT/MD extraction into review only; access checked again after processing. 10 MB, 30 pages, bounded archive/text/worker limits. No persistence until reviewed create.                                                   |

Document bodies are bounded to 2,000,000 bytes. Parse transport allows 15,000,000 bytes for multipart/base64 overhead while decoded files remain capped at 10 MB. Personal owner-only snapshots may contain resume-local contacts; master UserContact/professional fields are never imported. Original bytes are discarded, confirmed text remains private version data. Full D12/F19 contact separation/staging/export remain pending. Legacy generation/tailoring, direct import and sharing remain blocked. Current readiness/JD/scoped AI, recoverable delete and owner PDF routes are described above. Wider route tables below remain planned or merged backend capabilities, not enabled frontend promises.

## Resume service

### Enabled personal deletion and PDF transport — 2026-10-08

Current local gateway routes are `/api/v1/resume/:id` DELETE with strict `{ expectedVersion: positiveInteger }`, `/api/v1/resume/:id/restore` POST with that same body, and `/api/v1/resume/:id/pdf?version=N` GET with exactly one positive bounded version query. Each requires authenticated personal workspace ownership; the workspace header is only a selector. DELETE tombstones the row and invalidates its artifact key; POST restores draft status with unchanged immutable content/version. Wrong owner/deleted reads return 404, stale versions 409, malformed input 422, unavailable rendering/audit 503. Deleted resources cannot save, download or be recreated by retrying creation. No physical purge is enabled.

PDF GET accepts only the current saved editor version, rechecks actor/resource/version after rendering, and captures a sanitized `resume.downloaded` event with the immutable version ID. It returns `application/pdf`, attachment filename, `X-Resume-Version`, `nosniff`, and `Cache-Control: no-store`. Errors remain JSON. The gateway exposes only those necessary attachment/version headers to the shell, strips upstream cookies, and preserves no-store. PDF transport timeout is 30 seconds; renderer timeout is 25 seconds. D12 authorizes resume-local contacts for this personal-owner stream; shared/contact-free variants stay unavailable. The older `/download` formats and broader planned table below are not enabled in the personal gateway. [Current export limits](../README.md#delete-resumes-and-download-saved-pdfs--2026-10-08).


| Method | Path                   | Contract / permission                                                                                               |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| POST   | `/jd/parse`            | profileId + bounded rawJD → saved parsed JD; profile access and `resume.create` in this draft                       |
| POST   | `/resume/generate`     | profileId, jdHistoryId, templateId, expected input revisions → resumeId/runId; `resume.generate` + create authority |
| POST   | `/resume/token`        | Verified runId → short-lived run-scoped subscription token; current resource access                                 |
| GET    | `/resumes`             | Paginated scoped resume summaries; `resume.read`                                                                    |
| GET    | `/resume/:id`          | Sanitized current content/version metadata; `resume.read`                                                           |
| PUT    | `/resume/:id`          | User-edited content + expected revision → new version; `resume.update`                                              |
| DELETE | `/resume/:id`          | Remove access and schedule safe artifact cleanup; `resume.delete`                                                   |
| GET    | `/resume/:id/download` | Version/variant selection resolved server-side → authorized PDF; `resume.download`                                  |
| POST   | `/ats/score`           | Authorized version + JD → stored five-component score; `ats.run`                                                    |
| POST   | `/skills/gap-analysis` | Phase 5 authorized profile/version + JD → grounded gaps; `skillgap.analyze`                                         |
| GET    | `/templates`           | Available registry entries and versions; `template.view`                                                            |
| GET    | `/jd-history`          | Scoped paginated history; `profile.read` + `resume.read` in this draft                                              |

Proposed additions: `GET /resume/:id/versions`, `GET /resume/:id/versions/:versionNumber`, `GET /resume/runs/:runId`, `POST /resume/:id/export`, and `GET /jd-history/:id`. Each uses its parent read/generate/download permission and current scope. Contact-bearing versions/export variants additionally require `profile.contact.read`.

For a “paste JD and generate” UI, first call JD parse or have the generate use case invoke the same parser with rawJD. Define one validated union contract before implementation; do not create divergent parser behavior. F05 owns input validation and F06 owns orchestration.

## Workspace service

| Method | Path                                   | Contract / permission                                                                  |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------------- |
| GET    | `/workspaces`                          | Actor's personal workspace and current memberships only                                |
| POST   | `/workspaces/switch`                   | Validate selected membership; return scoped capabilities; no privilege change          |
| POST   | `/organizations`                       | Authenticated workspace creation under approved creation limits; creator becomes owner |
| GET    | `/organizations/:id`                   | Sanitized details; `workspace.settings.view`                                           |
| GET    | `/organizations/:id/members`           | Sanitized members; `workspace.members.view`                                            |
| POST   | `/organizations/:id/members`           | Invite to allowed role; `user.invite` plus grant constraints                           |
| PUT    | `/organizations/:id/members/:memberId` | Validated role/status change; `workspace.members.manage` / `user.manage` as applicable |
| DELETE | `/organizations/:id/members/:memberId` | Remove membership; `user.remove`; preserve final owner                                 |
| POST   | `/vendors`                             | Create vendor; no automatic access to others' profiles                                 |
| GET    | `/vendors/:id/members`                 | Scoped sanitized list; `workspace.members.view`                                        |
| POST   | `/vendors/:id/members`                 | Invite/assign only after D02 is resolved                                               |

Proposed symmetry additions: `GET /vendors/:id`, `PUT/DELETE /vendors/:id/members/:memberId`, `PUT /workspaces/:id/settings`, `POST /workspace-invitations/:token/accept`, invitation revoke/resend operations, and `GET /workspaces/:id/audit`. Invitation token redemption is identity-bound; audit requires `audit.view`. Detailed creation, delegation, and owner-transfer policy is finalized in F13/F14, not by adding new permission names casually.

## Storage service

| Method | Path                        | Contract                                                                                           |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------- |
| POST   | `/storage/presign/upload`   | Authorize allowed purpose/resource, set type/size/key limits, return short-lived upload capability |
| POST   | `/storage/presign/download` | Resolve authorized version/artifact and privacy variant; return bounded capability                 |
| DELETE | `/storage/object`           | Resolve approved resource deletion via domain policy; reject arbitrary bucket/key deletion         |

Do not accept a raw R2 key as proof of ownership. Prefer domain download/export APIs for application UI. Storage operations enforce the owning feature's permissions; there is no implicit all-powerful `storage` permission.

## Internal calls

Planned examples: `GET /internal/profile/:id`, `GET /internal/user/:id`, and `POST /internal/upload`. These require service identity and verified actor/resource context and are not gateway routes. Profile responses still apply privacy; privileged internal networking never justifies a raw UserContact dump.

Implementation will add OpenAPI/schema fixtures and contract checks alongside these descriptions. Use the tracker for endpoint implementation status; this document is not proof of complete API coverage.

## Proposed basic-builder and section-suggestion routes (F06/F08)

The complete payload, lifecycle, idempotency and conflict rules are in [editing contract](../context/resume-editing-contract.md). All routes retain the `/api/v1` prefix and current scoped authorization.

| Method | Path                                            | Contract                                                                                                                                   |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/resumes`                                      | Explicit blank/profile-copy mode with authorized profile association and template; JD optional; resume.create + input/template read access |
| POST   | `/resume/:id/suggestions`                       | Explicit target/base-version/action/instruction → private suggestion/run; resume.read + resume.generate + resume.update                    |
| GET    | `/resume/:id/suggestions/:suggestionId`         | Scoped proposal/status/provenance with current parent/input read access                                                                    |
| POST   | `/resume/:id/suggestions/:suggestionId/apply`   | Expected revision + idempotency; apply stored validated proposal as one new version; resume.read + resume.update                           |
| POST   | `/resume/:id/suggestions/:suggestionId/discard` | Mark unapplied suggestion discarded; resume.update; late worker completion cannot reactivate it                                            |

Resolve all inputs under workspace/profile policy. Requests cannot set arbitrary patch paths, generated replacement bodies or authority fields. Apply returns 409 for stale base/target/context; retries with matching identity return the existing result. Manual saves remain PUT `/resume/:id`. Scoring requires a JD and exact version; basic drafts return absent score metadata. Full F19 staging routes below remain proposals. The bounded local personal parse/review/create slice above has its own resolved D14 choices and verification.

## Proposed U06 dashboard, feedback and Phase 6 routes

These add planning contracts only. Resolve ownership, contacts, revisions and idempotency with the same domain use cases, not UI authority.

| Method / route                               | Input and behavior                                                                         | Existing permission / boundary                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `GET /resumes` (expanded)                    | Bounded query, allowlisted sort, cursor/page size; authorized summary fields only          | resume.read; F10; search cannot leak inaccessible titles                             |
| `PATCH /resume/:id/metadata`                 | Title and expected revision; content unchanged                                             | resume.update; F10                                                                   |
| `POST /resume/:id/clone`                     | Source version and idempotency → new independent same-workspace draft                      | resume.read + resume.create + input/template access; current contact projection; F10 |
| `GET/PUT /resume-preferences`                | Own active resume ID or null; expected preference revision on write                        | resume.read and own actor/workspace scope; no access grant; F10                      |
| `PUT /resume/:id/issues/:issueId/preference` | Dismiss/reopen for actor; does not alter evaluation or score                               | ats.view + resume.read; issue/version scope; F07                                     |
| `POST /resume-imports`                       | Owned private upload reference + target profile/template + idempotency → staged task       | F19 resume.create/template.view, profile.read and contact policy below               |
| `GET /resume-imports/:id`                    | Authorized extraction/review DTO                                                           | Creator + current target/input authority; contact-safe projection                    |
| `POST /resume-imports/:id/confirm`           | Staging revision, validated corrections and idempotency → new resume/version               | Same creation/contact authority; no profile mutation                                 |
| `POST /resume-imports/:id/cancel`            | Creator-authorized terminal cancellation and cleanup request                               | Current import scope; no late publication                                            |
| `PUT /resume/:id` (F20 expansion)            | Explicit content or appearance operation with expected revision; validated render settings | resume.update + template.view; no arbitrary patch/CSS                                |
| `GET /template-presets`                      | Own and permitted workspace presets                                                        | template.view; settings only, no resume content                                      |
| `POST /template-presets`                     | Create personal or shared validated settings preset                                        | Own personal scope + resume.update; shared scope template.manage                     |
| `PUT/DELETE /template-presets/:id`           | Expected revision update/archive; old version references remain resolvable                 | Same ownership/manage rules; F20                                                     |

F19 uses existing authorized storage presign with an import-specific purpose and limits; it cannot process arbitrary bucket keys or external URLs. Upload/processing/review of contact-bearing files requires profile.contact.read and profile.contact.update for the target identity. Until server-side separation can be proven, require those permissions for all imports and restrict uncertain results rather than exposing raw text. Confirm stores protected resume-header data only, never writes UserContact. D14 resolves concrete formats/provider/quotas/retention before routes are enabled.

## Implemented local internal audit transport (Phase 1)

`POST /internal/audit/events` on workspace-service at `127.0.0.1:4005` (no external `/api/v1` prefix and no gateway forwarding). Requires `X-Resume-Forge-Service: local-audit-relay` and `Authorization: Bearer <local server key>`. Unknown identity/bad credentials return 401 before parsing; Origin-bearing requests return 403. No CORS or public audit read API is enabled.

Body: the existing AuditEventIntent fields (`eventId`, `actorUserId`, optional `targetUserId`, `workspaceType`, `workspaceId`, `action`, `resourceType`, `resourceId`, `outcome`, `occurredAt`, `correlationId`, optional allowlisted `metadata`), maximum 16 KiB. Unknown fields are rejected. Local ingestion accepts approved successful individual-workspace intents whose actor owns the workspace, plus `authorization.denied`/`denied` intents whose resource is that owned workspace. Denied profile/foreign-workspace resource IDs, other failed outcomes and shared scope remain rejected. The producer must already have verified the actor, action and resource when capturing the history.

Committed success: HTTP 200 `{ data: { eventId, duplicate } }`. Equivalent retries return the same event ID with `duplicate: true`; conflicting ID reuse returns 409. Errors are `{ error: { code } }`: 400 malformed JSON, 413 size, 415 media type, 422 invalid intent/scope, 503 temporary ingestion failure. Acknowledgement is sent only after SQL COMMIT. The client validates the bounded reply/event identity, rejects redirects, and retries authentication/unavailability failures through its durable outbox. This is a local credential and loopback policy only; production identity, scheduling and database privileges remain gated. See [setup and verification](database-foundation.md).

## Local professional browser transport — 2026-10-04

The local gateway on loopback port 4000 now forwards GET/POST/PUT `/api/v1/profile` and PUT `/api/v1/profile/draft` to loopback profile-service port 4002. Browser requests originate at `http://localhost:3000` and carry the existing opaque Bearer plus personal workspace selector. Profile-service independently resolves/authorizes every actor/resource; the gateway supplies no identity authority. Cookies and arbitrary actor headers are dropped, upstream error/request IDs are preserved, and responses are no-store. Contacts, sections, completion, internal auth and resume routes remain unavailable through this gateway. This transport is refused in production; hosted topology remains D10. [README](../README.md#personal-profile-integration-and-sign-in-repair--2026-10-04) records current scope/manual checks.
