# Local professional profile API

**Current integration — 2026-10-04:** The latest user request removes required Create profile onboarding and replaces the sample resume with an owned library/upload/review/version-save flow. Work runs in the named frontend worktree; port 4003 now belongs to the restricted personal resume service. Dialog Save changes the working draft; editor Save changes persists a version. Professional profile editing remains optional. Earlier sample/reset/profile-first or stopped-resume statements below are historical. [Current changes, startup and manual checks](../README.md#resume-library-upload-and-database-saves--2026-10-04).

Phase 1 implements POST, GET and PUT `/api/v1/profile` and PUT `/api/v1/profile/draft` for an individual user's master professional profile. POST explicitly initializes a missing profile; GET/PUT read/update an existing one; draft PUT partially saves professional fields during incomplete onboarding. The subsequent [Work Experience slice](experience-api.md) adds owned list/add/update using the same master revision. Each request resolves its actor through auth-service, checks the owned personal workspace and action, scopes profile queries to that user, and captures audit intent before returning. Entry deletion/reorder, other section/contact APIs, setup completion and browser integration remain pending.

## Start and check

From the repository root, with PostgreSQL command-line tools installed:

```bash
pnpm db:local:start
pnpm db:migrate
pnpm db:runtime:init
pnpm auth:local:init
pnpm dev
```

Profile-service listens on `127.0.0.1:4002`; auth-service on `127.0.0.1:4001`. The profile service reads ignored local configuration directly, checks its restricted database role at startup, and refuses production mode. These routes are accessed directly during development; the gateway does not forward them yet. For audit ledger delivery, initialize and run the recipient and worker as described in [database notes](database-foundation.md).

In another terminal:

```bash
curl -i http://127.0.0.1:4002/api/v1/profile
curl -i -X POST http://127.0.0.1:4002/api/v1/profile \
  -H 'Content-Type: application/json' -d '{}'
curl -i -X PUT http://127.0.0.1:4002/api/v1/profile \
  -H 'Content-Type: application/json' -d '{}'
curl -i -X PUT http://127.0.0.1:4002/api/v1/profile/draft \
  -H 'Content-Type: application/json' -d '{}'
pnpm db:test:profile
```

All unauthenticated requests must return HTTP 401, `Cache-Control: no-store`, a request ID and no profile/contact data. The database test now prints 44 passes: 22 professional-profile cases (21 scenarios plus parent) and 22 subsequent [Work Experience cases](experience-api.md#verify-locally), with zero failures. Professional coverage includes explicit creation/read/save/reload, partial draft preservation/null clearing, owner isolation, concurrent/repeated creation without overwriting, shared draft/full revisions, completion races, mass assignment, session revocation, audit COMMIT failures and real restricted relay→HTTP→ledger delivery. The two suites use only synthetic fixtures in independently disposable databases and temporary roles; they do not create a development profile or modify development users.

Also sign in/out through `http://localhost:3000` to check the existing shell routing. A new account receives 404 from GET/PUT/draft PUT until it explicitly initializes a profile through POST. Initialization and draft saves leave onboarding incomplete; auth names/emails are never copied into professional/contact fields. The setup entry and profile preview remain disconnected from persistence; this slice adds no wizard or saved-state UI. Restart local services to load the corrected [UTC database connections](database-foundation.md#utc-application-connections--2026-10-04).

## Request and response

The external Authorization header is `Bearer <current application access credential>`; refresh cookies alone do not grant access. The internal service key is never a browser credential. Do not copy real credentials into commands, screenshots, logs or Git.

GET returns `{ data, requestId }`, with exactly these professional fields:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "fullName": "Example Person",
  "location": null,
  "professionalSummary": null,
  "revision": 1
}
```

POST accepts an explicit full name, with optional nullable location and summary:

```json
{
  "fullName": "Example Person"
}
```

Omitted optional fields default to null. POST requires `profile.create` in the actor's owned personal workspace and returns HTTP 201 with the same professional DTO at revision 1. It creates no contacts, sections or onboarding completion state, and never imports auth/provider facts. The database's unique user ownership constraint ensures concurrent/repeated creation cannot duplicate or overwrite the master. If one already exists, POST returns HTTP 409 `profile_exists` with no success event or mutation. A client recovering an uncertain response should GET the existing profile before choosing a revisioned PUT; POST is not an upsert or a completed onboarding retry API. No schema migration or broader database grant is needed.

PUT requires all three professional fields and the last observed revision:

```json
{
  "fullName": "Example Person",
  "location": "Example City",
  "professionalSummary": "User-supplied professional facts.",
  "expectedRevision": 1
}
```

Strings are trimmed. Name is required, maximum 200 characters; location is nullable, maximum 200; summary is nullable, maximum 5,000. Revision is a positive integer below the PostgreSQL integer ceiling. Unknown fields, missing fields, contact data, ownership/workspace IDs, auth data, onboarding state and embeddings are rejected. The actual JSON body is limited to 32 KiB with a three-second read deadline. PUT succeeds with the same professional DTO and increments revision once; a stale revision returns 409 without a mutation or success event. The [Prisma transaction and optimistic concurrency contracts](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions) inform this boundary.

### Partial professional onboarding save

PUT `/api/v1/profile/draft` accepts at least one professional field and the last observed revision:

```json
{
  "expectedRevision": 2,
  "professionalSummary": "User-supplied professional facts."
}
```

Missing professional fields retain their values. Explicit null clears location/summary; name cannot be blank or null. The same bounds/strict unknown-field rejection apply. Revision-only/empty requests are invalid. The profile must already exist and `onboardingCompletedAt` must be null: no implicit creation, invented names, completion or reopening. A successful save returns 200 with the same professional DTO and increments the master revision once. GET `/profile` reloads it. Draft and full PUT share this revision, so competing writes elect one winner; stale saves return 409 `revision_conflict`. Completion is checked in the atomic update predicate, including a racing completion: completed profiles return 409 `onboarding_complete` with no mutation/success event. Normal PUT remains available for authorized completed-profile edits.

The optional `X-Workspace-Id` selector must match the verified personal workspace. Foreign, malformed or empty selectors return 403; their raw values are never copied into audit history. Profile IDs in query parameters are rejected with 422 and unsupported paths/verbs return 404. Client user/role headers cannot switch the target. No shared workspace or contact permission is activated.

Errors use `{ error: { code, message }, requestId }`, with fixed messages and no raw database exceptions: 401 missing/invalid/expired session, 403 denied scope, 404 absent own profile on GET/PUT/draft PUT, 409 revision conflict, `profile_exists` or `onboarding_complete`, 422 field/query validation, 503 auth/database/audit unavailable. Malformed JSON, oversized bodies, unsupported media types and stalled bodies return 400/413/415/408 respectively. Responses are not cacheable. CORS permits only the local shell origin on these paths; POST/PUT reject a different supplied Origin. A browser origin does not replace Bearer authentication. Experience has its own bounded entry/response contract and `section_limit` conflict, described separately.

## Audit and limits

Successful reads capture `profile.viewed`; successful updates capture `profile.updated`. The selected DTO or mutation and the validated content-free outbox insert share one SQL transaction. A failure at COMMIT withholds reads and rolls back updates, so no success response escapes without durable capture. The profile role can only INSERT outbox rows; it cannot read the ledger, auth sessions or User table.

Explicit initialization uses the existing `profile.updated` event with `{ permission: "profile.create", status: "initialized" }`; the canonical 22-event vocabulary is unchanged. Creation and its outbox record commit together. Failed COMMIT removes the new row and event; retry can then initialize safely. Denied creation is captured in the same owned workspace as other professional actions. Concurrent/repeated attempts that find an existing profile produce no extra initialization event.

Draft saving uses `profile.updated` with `{ permission: "profile.update", status: "draft_saved" }`, atomically with its partial update. Failed audit COMMIT rolls back fields and revision; retry with the unchanged revision can succeed. The restricted relay/ledger accepts this existing event/metadata contract without new grants or event names. No saved field text or protected contact is included.

Denied workspace selectors capture `authorization.denied` in the actor's verified owned workspace, with only the permission and a fixed reason code. Capture failure returns 503. Invalid sessions/bodies, absent profiles and conflicts do not produce success events. Local ingestion now accepts these workspace-scoped denial intents alongside existing successful intents; denied profile/foreign-workspace resources and conflicting event-ID reuse remain rejected. No professional or contact text is retained in audit payloads.

Session resolution is fresh for each request and expiry is checked again during domain work. Resolution and a later profile transaction are not a distributed atomic revocation boundary. D05 shared-role mappings, production identity/network policy, hosted supervision and D11 retention remain pending; F02/F03/F04/F15 are not complete.

2026-10-04 verification: affected dependency build, access-policy/profile lint and typecheck pass; access-policy tests 19/19, route tests 6/6 and local profile integration 18/18 pass. The initial policy HTTP test was blocked by sandbox loopback permissions; the authorized rerun passed. The expanded delivery test exposed an old single-owner fixture assumption, corrected to verify initialization and denial events for each owner. No frontend code, secrets or development users changed; no browser/provider E2E was performed in this slice. Suggested commit: `feat: add owned professional profile creation`.

2026-10-04 draft verification: dependency build, profile lint/types and Prisma types pass; route tests 7/7 and profile integration 22/22 pass. The completion-race test exposed a two-hour offset from adapter-pg's timezone normalization; changing a fixture alone did not fix it. Application connections now request UTC while preserving other startup options. Regression checks pass: `pnpm db:test` 14/14 (including non-UTC database/URL defaults and exact timestamp round trips), `pnpm db:test:audit` 12/12 and `pnpm --filter @resume-forge/auth-service test:db` 11/11. All 66 cases pass in their final runs; initial failures are recorded here. Fixtures/databases/roles are disposable; no development data, secrets, schema migration or DB grants changed. Formatting/syntax/diff checks pass. No frontend/browser/live-provider checks were run. Full F04/E06 remains pending. Suggested commit: `feat: save revisioned professional onboarding drafts`.

## Browser integration — 2026-10-04

Professional POST/GET/PUT and draft PUT now have a typed frontend client and loopback gateway route. The shell's onboarding and My profile use the same form. The API schema/ownership/revision semantics above remain unchanged; contacts and sections are not forwarded by the gateway. [README](../README.md#personal-profile-integration-and-sign-in-repair--2026-10-04) covers manual save/reload/conflict checks and current named-worktree startup. The root profile database-test command now builds gateway and service dependencies for the added client/gateway round-trip case; selected auth/professional tests can read the primary ignored configuration via `RESUME_FORGE_LOCAL_ROOT`. Other backend suites are outside this slice's fresh verification.
