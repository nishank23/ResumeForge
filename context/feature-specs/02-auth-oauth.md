# F02 — Google and LinkedIn OAuth

**Phase:** 1 — Foundation · **Priority:** Critical · **Implementation:** In progress — local Google/session slice; real provider verification pending

**LinkedIn status (2026-10-01): On hold by user request — awaiting OAuth client credentials and provider configuration.** Continue independent Google/session work; do not mark the two-provider acceptance complete.

## Goal and dependencies

Authenticate users with Google/LinkedIn and establish revocable application sessions. Requires F03's identity/session/personal-workspace foundations, F01 sign-in components, and D08/D10 configuration decisions. Consult [API contracts](../../docs/api-reference.md) and [authorization model](../authorization-model.md).

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

Shell session bootstrap and browser refresh/logout coordination are implemented; protected routing and persisted onboarding remain pending. Session controller tests use synthetic responses; they are not real Google consent verification.
