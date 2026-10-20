> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# F02 — Google and LinkedIn OAuth

## Audited status — 2026-10-11

**Partially done.**

- [x] ✅ Google PKCE callback, provider-subject identity, transactional personal workspace bootstrap, revocable/rotating database refresh sessions, in-memory access grants, shell protection and direct library landing. [Source](../../../../../services/auth-service/src/app.ts).

**Remaining:** LinkedIn has an unused provider module and disabled UI; callback/linking flow, hosted/distributed access and production cookie/identity configuration are missing. Mandatory profile onboarding was removed.

This snapshot supersedes dated implementation/pending statements below. Full acceptance stays unchecked where integration or verification is missing. [Complete audit](../../docs/implementation-audit.md).

**Phase:** 1 — Foundation · **Priority:** Critical · **Implementation:** Partially done (audited 2026-10-11)

**LinkedIn status (2026-10-01): On hold by user request — awaiting OAuth client credentials and provider configuration.** Continue independent Google/session work; do not mark the two-provider acceptance complete.

## Goal and dependencies

Authenticate users with Google/LinkedIn and establish revocable application sessions. Requires F03's identity/session/personal-workspace foundations, F01 sign-in components, and D08/D10 configuration decisions. Consult [API contracts](../../../../api-reference.md) and [authorization model](../../../../../context/authorization-model.md).

## Ownership and planned files

`services/auth-service/src/`, `services/gateway/src/`, `apps/auth-mfe/src/`, shell session bootstrap, shared auth schemas, and auth-owned Prisma models. Workspace service owns idempotent personal-workspace provisioning; profile service owns onboarding data.

## Build scope

1. Register provider-specific redirect/scopes for each environment and verify current official OAuth/OIDC requirements. Login access does not authorize full LinkedIn data import.
2. Implement URL/callback flows with a bound expiring transaction, state validation, and applicable PKCE/nonce checks. Reject reused or mismatched callbacks.
3. Resolve identity by provider+subject, apply the approved account-linking policy, and provision one personal workspace idempotently.
4. Issue short-lived application access credentials and rotating revocable refresh sessions under the approved transport. Keep secrets/refresh credentials out of localStorage and public bundles.
5. Implement refresh, logout, minimal `/auth/me`, protected routing, onboarding redirect, and recovery from expired sessions.

## Failure and privacy behavior

Provider cancellation, unavailable provider, invalid callback, expired session, duplicate callback, and refresh replay return safe user-facing states. Failed downstream workspace provisioning is retryable without duplicate accounts/workspaces. Identity email and provider metadata never appear in unauthorized workspace member/profile DTOs.

## Acceptance and verification

- [ ] Both configured providers complete sign-in and route the user appropriately.
- [ ] Invalid/replayed state or code, malicious return URLs, and refresh replay are rejected.
- [ ] Logout revokes the application session; expired credentials cannot access protected APIs.
- [ ] Repeated sign-in creates no duplicate personal workspace or accidental email-based account merge.
- [ ] Browser bundles, logs, and responses contain no client secrets/raw refresh tokens.
- [ ] Integration checks cover denied callbacks and session lifecycle; sandbox provider testing is recorded separately from mocks.

Full profile import is F16. No Clerk integration or recruitment identity model is included.

## Session-aware prompt surfaces — 2026-09-29 planning update

Use F01 shared primitives on auth screens; do not add AI input to sign-in. Resume prompt routes remain protected. Session expiry/logout clears private selections, drafts and proposal caches under the existing privacy policy; a later sign-in must reauthorize any saved suggestion.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Expired sessions cannot submit/read/apply suggestions or populate a newly signed-in user’s view with prior private state.

Shell session bootstrap, browser refresh/logout coordination and protected personal routing are implemented. Persisted onboarding remains pending. Session controller/routing tests use synthetic responses; they are not real Google consent verification.

## P1.4 protected shell entry — 2026-10-02

- [x] Wait for verified session state before mounting workspace/onboarding content; anonymous sessions redirect to sign-in, verification failures show retry recovery.
- [x] Bind navigation/federation context to the personal workspace returned by `/auth/me`; deny mismatched URL selectors, including the old hardcoded preview ID.
- [x] Remount route content when actor/workspace/status changes, removing mounted drafts/selections after access loss. Ignore return URLs; only a verified OAuth success without an error flag hands off to the server-derived home route.
- [x] Send incomplete accounts to an authenticated setup entry; completed accounts enter their personal workspace. The entry explicitly states setup is not yet connected and offers the protected sample workspace. It does not save a profile or change onboarding status.

These are browser navigation controls, not backend permission enforcement. No private profile/resume API is enabled; sample content remains unsaved. Standalone remotes remain synthetic previews without private service access. F02 stays in progress while LinkedIn, explicit linking, full provider verification and persisted onboarding remain incomplete.

## P1.4 local server actor boundary — 2026-10-02

- [x] Authenticate the local profile-service caller before parsing/lookup; separate its generated service credential from the actor access credential. Reject browser Origin requests and unknown body fields.
- [x] Resolve the current persisted session and personal workspace with a minimal projection; never return identity email/name, provider data, profile/contact content, refresh/session identifiers or role bundles.
- [x] Recheck expiry after database I/O and reject rotated/revoked/replayed/expired sessions or absent personal scope. Auth process restart invalidates old access grants. Database failure withholds identity and recovers on retry.
- [x] Provide a server-only, noncached loopback adapter with bounded strict responses, timeout, redirect refusal and production guard. Preserve external browser CORS and refresh behavior.

This completes the identity prerequisite for private profile use cases, not action/resource authorization or private route persistence. Hosted service identity/TLS/distributed session storage remain deferred. See [actor contract and verification](../../../../actor-resolution.md).

## Verified-session welcome handoff — 2026-10-10

The current shell sends every authenticated `/sign-in` visit to the personal resume route derived from the verified identity. Query flags (`signed_in`, legacy `auth`, `auth_error`, or return URLs) never select a workspace or grant access. Pending verification renders session loading; anonymous or failed sessions retain welcome/recovery. This supersedes the historical success-flag-only navigation rule above. Sign-out is available in Preferences; failed revocation still uses the existing retry recovery. Browser testing confirms normal existing-account Google sign-out/sign-in and direct library landing. No OAuth provider, token, membership or service policy changes are included.

## Full-screen auth presentation — 2026-10-10

Signed-out shell entry now uses one edge-to-edge ASCII scene containing its header/theme control, wordmark, Google card and footer. Desktop/mobile layouts and extended static fallback preserve readable controls. Existing provider/session/retry handlers and verified library handoff remain unchanged; this is not additional OAuth acceptance evidence. [Checks and manual steps](../../../readme-history.md#full-screen-ascii-sign-in--2026-10-10).
