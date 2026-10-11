# Local Google sign-in

## Implemented scope — 2026-10-11

- [x] ✅ Google PKCE callback, provider identity and personal Workspace bootstrap.
- [x] ✅ Database refresh-session rotation/revocation and protected shell routing.
- [x] ✅ Authenticated users land in My resumes; signed-out users see the full-screen Forge Studio sign-in without workspace sidebar.
- [ ] LinkedIn login/linking and hosted identity/cookie/service configuration remain incomplete.

Implementation: [auth app](../services/auth-service/src/app.ts), [session controller](../packages/shared/src/index.ts) and [shell](../apps/shell/src/App.tsx).

## Configuration and startup

Use the [README's verified setup](../README.md#setup-and-installation). In the primary checkout's private .env, set nonempty GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Omit unset variables instead of blank assignments. Register:

```text
http://localhost:4001/api/v1/auth/google/callback
```

In Google consent testing mode, add the testing account. Initialize the local database, runtime roles and auth transport file in the documented order, then run `pnpm dev:personal` in the active worktree. It resolves the primary configuration automatically; RESUME_FORGE_LOCAL_ROOT is the explicit override.

Open http://localhost:3000. Using 127.0.0.1 changes the allowed browser origin. Sign-in does not require creating a profile. Use Preferences to sign out.

## Manual verification

1. Signed out: /sign-in shows Google sign-in without sidebar.
2. Complete Google sign-in: the owned resume library opens with sidebar.
3. Reload and reopen the library: session resolution preserves authorized access.
4. Open Preferences and sign out: protected routes return to sign-in.
5. Use a second account: other users' resources must be denied.

These are current manual steps, not freshly executed OAuth tests in the documentation audit. Never paste keys/tokens in logs or docs. Previous local-password failures are historical configuration incidents; do not copy/reset role passwords between worktrees. [Runtime credential boundary](runtime-database-roles.md).
