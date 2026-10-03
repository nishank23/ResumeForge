# Local professional profile API

Phase 1 implements GET and PUT `/api/v1/profile` for an existing individual user's master profile. It resolves each actor through auth-service, checks the owned personal workspace and action, scopes every profile query to that user, and captures audit intent before returning. Profile creation, onboarding draft/setup, contacts, sections and browser integration remain pending.

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
curl -i -X PUT http://127.0.0.1:4002/api/v1/profile \
  -H 'Content-Type: application/json' -d '{}'
pnpm db:test:profile
```

Both unauthenticated requests must return HTTP 401, `Cache-Control: no-store`, a request ID and no profile/contact data. The database test prints 13 passes (12 scenarios plus their parent), with zero failures. It verifies positive read/save/reload behavior, two-owner isolation, revisions, mass assignment, session revocation, audit COMMIT failures and real restricted relay→HTTP→ledger delivery. It uses only synthetic fixtures in a disposable database and temporary roles; it does not create a development profile or modify development users.

Also sign in/out through `http://localhost:3000` to check the existing shell routing. A new account still has no master profile and receives 404 from this API. The setup entry and profile preview remain disconnected from persistence; this slice adds no wizard or saved-state UI.

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

The optional `X-Workspace-Id` selector must match the verified personal workspace. Foreign, malformed or empty selectors return 403; their raw values are never copied into audit history. Profile IDs in query parameters are rejected with 422 and alternate paths return 404. Client user/role headers cannot switch the target. No shared workspace or contact permission is activated.

Errors use `{ error: { code, message }, requestId }`, with fixed messages and no raw database exceptions: 401 missing/invalid/expired session, 403 denied scope, 404 absent own profile, 409 revision conflict, 422 field/query validation, 503 auth/database/audit unavailable. Malformed JSON, oversized bodies, unsupported media types and stalled bodies return 400/413/415/408 respectively. Responses are not cacheable. CORS permits only the local shell origin; PUT rejects a different supplied Origin. A browser origin does not replace Bearer authentication.

## Audit and limits

Successful reads capture `profile.viewed`; successful updates capture `profile.updated`. The selected DTO or mutation and the validated content-free outbox insert share one SQL transaction. A failure at COMMIT withholds reads and rolls back updates, so no success response escapes without durable capture. The profile role can only INSERT outbox rows; it cannot read the ledger, auth sessions or User table.

Denied workspace selectors capture `authorization.denied` in the actor's verified owned workspace, with only the permission and a fixed reason code. Capture failure returns 503. Invalid sessions/bodies, absent profiles and conflicts do not produce success events. Local ingestion now accepts these workspace-scoped denial intents alongside existing successful intents; denied profile/foreign-workspace resources and conflicting event-ID reuse remain rejected. No professional or contact text is retained in audit payloads.

Session resolution is fresh for each request and expiry is checked again during domain work. Resolution and a later profile transaction are not a distributed atomic revocation boundary. D05 shared-role mappings, production identity/network policy, hosted supervision and D11 retention remain pending; F02/F03/F04/F15 are not complete.
