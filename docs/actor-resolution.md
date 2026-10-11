# Local authenticated actor resolution

## Current audit status — 2026-10-11

Local session-authenticated personal actor resolution is implemented and consumed by profile/resume. Hosted/distributed identity and consented shared access remain incomplete.

See the [full source-linked audit](implementation-audit.md). Dated checkpoints below remain history.

Phase 1 provides the identity boundary for private profile APIs. Auth-service verifies the actor's current access grant and persisted session; consumers use `createLocalActorResolver` from the server-only `@resume-forge/access-policy/server` entrypoint. The subsequent [professional profile API](profile-api.md) consumes this boundary; wizard save remains pending.

## Start and check

With the managed local PostgreSQL database already migrated and runtime roles initialized:

```bash
pnpm auth:local:init
pnpm dev
```

Restart the auth service after initialization. The initializer creates a random 256-bit service credential in ignored `.local/auth-transport.env`, mode 0600. Repeating it preserves the credential. It is separate from the audit relay key and Google OAuth secret; never use a `VITE_` variable or copy it into a browser request, logs, chat or version control. The auth service reads this file directly, ignoring root/process service-key overrides. Without the file, browser auth still works but internal resolution returns 503.

In a separate terminal, verify credential-free callers are denied:

```bash
curl -i -X POST http://127.0.0.1:4001/internal/auth/resolve \
  -H 'Content-Type: application/json' -d '{}'
```

Expect HTTP 401, `service_unauthorized`, `Cache-Control: no-store` and no CORS grant. The gateway does not forward `/internal/*`. Auth binds only to loopback. Production mode is refused; hosted service identity, TLS/network policy and credential distribution/rotation remain D10 deployment work.

Run the automated synthetic checks:

```bash
pnpm --filter @resume-forge/auth-service... build
pnpm --filter @resume-forge/access-policy test
pnpm --filter @resume-forge/auth-service test
pnpm --filter @resume-forge/auth-service test:db
```

Expect 19 access-policy cases (11 policy + 8 actor adapter), 5 actor-route cases and 11 auth database cases, with zero failures. Database verification creates/removes its own synthetic database and temporary service roles. It does not seed or modify development users. Sign in and sign out through the existing Google UI as a manual regression check; no fresh Google consent was automated for this slice.

## Internal contract

`POST /internal/auth/resolve` requires `X-Resume-Forge-Service: local-profile-service` and a Bearer **service** credential. Its strict JSON body is `{ accessToken }`, containing the current actor's opaque five-minute application credential. Refresh cookies alone are not accepted. The actual request and response bodies are each bounded to 512 bytes. Service authentication precedes parsing/session lookup; any browser Origin is rejected. CORS applies only to the existing external auth routes, following [Hono's path-scoped middleware contract](https://hono.dev/docs/middleware/builtin/cors).

Success is `{ data: { userId, personalWorkspaceId, expiresAt } }`, with expiry as Unix milliseconds. It contains no name, login email, provider identity/payload, refresh token/hash, profile/contact content, role bundle or session ID. The lookup selects only the required session/workspace fields and requires an individual workspace owned by the session user. Client actor/workspace/role fields in the body are rejected; identity headers cannot override the result. Missing scope, expired access/session, rotation, logout and refresh replay return 401 `unauthenticated`. Database failures return fixed 503 `auth_unavailable` without identity. Reads create/rotate no session and emit no profile/contact audit event because no domain content is accessed.

The server adapter accepts the original request Authorization header, sends only the extracted access credential to the fixed loopback route, and separately authenticates the service caller. It resolves every request afresh; it never caches identity or treats service credential possession as user authority. It checks the strict response, rejects stale/overlong expiry and private/unknown fields, forbids redirects/URL credentials/query parameters, and bounds HTTP headers/body waits to three seconds using Node's [AbortSignal timeout](https://nodejs.org/download/release/v22.15.0/docs/api/globals.html). Unavailable/invalid peers yield a fixed `unavailable` result, not an authenticated actor. Auth runtime connection/server statements are bounded to three seconds, with a four-second client query fallback.

## Consumer responsibilities and limits

The verified context establishes identity only. Profile use cases must still compare any workspace selector to authoritative scope, scope all target queries, check the requested action and resource ownership, project allowed fields and capture required audit intent transactionally. The implemented professional GET/PUT now perform these checks. A caller-provided user ID is never an alternative to session verification. Organization/vendor role mappings and sharing stay inactive.

Do not serialize, cache or persist this internal context as a lasting capability. Later requests/background jobs must recheck current access, and `expiresAt` limits immediate use. A separate request cannot make session verification and a later domain transaction atomic; concurrent revocation semantics must not be overstated. Auth restart invalidates its process-local access map; the existing browser refresh flow recovers using a valid refresh cookie. This is a local development boundary, not distributed production JWT infrastructure.
