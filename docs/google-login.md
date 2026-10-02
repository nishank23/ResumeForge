# Local Google sign-in

The Google sign-in slice uses Arctic 2.3.4's installed API, a real server-side authorization-code exchange with PKCE, and validated Google userinfo. See [Google's web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server) and [Arctic's Google integration](https://arcticjs.dev/providers/google). No mock identities are accepted by the running server.

## Configuration

In the repository-root `.env`, set `GOOGLE_CLIENT_ID` to the **client ID**, ending in `.apps.googleusercontent.com`, and `GOOGLE_CLIENT_SECRET` to its corresponding secret. They are different values. Never use the secret as the client ID: the ID is included in browser URLs. If that happened, rotate the secret in Google Cloud. The service rejects malformed client IDs before constructing authorization URLs. Do not prefix either field with `VITE_`.

Use a Google OAuth **Web application** client. Register this exact authorized redirect URI:

```text
http://localhost:4001/api/v1/auth/google/callback
```

The callback is now a GET handled by the auth service, replacing the unfinished frontend-to-POST callback proposal. Keep the app at `http://localhost:3000`; do not mix `localhost` and `127.0.0.1` in the browser. If the Google consent app is in testing mode, add your Google account as a test user. LinkedIn implementation is on hold by user request (2026-10-01), awaiting provider credentials; its button remains disabled.

```bash
pnpm db:local:start
pnpm db:migrate
pnpm dev
```

Restart `pnpm dev` after editing `.env`. The service loads the root `.env`, then missing database configuration from `.local/database.env`; existing process environment values take precedence. Expected terminal message: `Auth service listening on http://localhost:4001`. An invalid client ID produces a configuration error without printing the value.

Open `http://localhost:3000/sign-in`, select **Continue with Google**, and complete Google's consent flow yourself. Once the shell verifies the returned session, incomplete accounts go to **Set up your profile** and completed accounts go to their personal workspace. The setup entry explicitly says profile setup is being connected; **Explore sample workspace** opens the protected preview. Visit `/sign-in` to test **Sign out** and repeat sign-in. No persisted profile wizard is implemented yet.

## Verification and boundaries

`pnpm --filter @resume-forge/auth-service test:db` builds the service and tests synthetic Google responses against disposable local PostgreSQL databases. Coverage includes PKCE URL shape, malformed client IDs, missing configuration, cookie binding, expired/replayed callbacks, cancellation/provider failure, unique provider identity and workspace, no email merging, refresh rotation/replay, token expiration and logout. No Google credentials or personal accounts are used in these automated tests.

Refresh credentials are random, hashed in PostgreSQL, and held in HttpOnly/SameSite=Lax cookies. Five-minute opaque access credentials remain in JavaScript memory; refresh expiry is absolute at 30 days. Origin checks protect POST endpoints. Each access request rechecks the persisted session. Pending OAuth attempts expire after ten minutes and are consumed before code exchange. Pending transactions/access tokens are process-local, so restarts require a retry/refresh. Concurrent refresh attempts intentionally invalidate a replayed family; the frontend deduplicates React StrictMode refresh requests. The shared shell/auth session controller now coordinates same-origin tabs through Web Locks and sends credential-free logout notifications through BroadcastChannel.

This implementation is restricted to loopback development and explicitly refuses `NODE_ENV=production`. Secure cookies, deployed topology, gateway authentication, distributed transaction/token storage, persisted onboarding, explicit account linking and LinkedIn remain pending. Auth-owned local account/workspace provisioning is transactional; extraction to the workspace service remains pending. No master profile is fabricated from OAuth data. Audit capture/local delivery foundations exist; private profile/resume route coverage remains pending.

On 2026-10-01 the browser handoff reached Google, which returned `invalid_client`: the local client-ID field contained a secret-formatted value. No Google account login or consent was completed. Correct credentials and Google Console redirect configuration require user verification; secrets were not copied into documentation or test fixtures.

Follow-up: the user updated the environment. The corrected ID format and live authorization endpoint were verified without printing credentials; the endpoint returned HTTP 200 with S256 PKCE and the documented callback. Google Console registration and successful consent remain manual checks.

## Manual session checks

Protected-routing checks (2026-10-02):

1. In a signed-out/private browser window, open `/onboarding` or `/w/ws-personal-01/resumes`. Expect sign-in, with no workspace child content or guest-preview bypass.
2. After sign-in, open `/`. Incomplete accounts see the pending setup entry. Its sample-workspace link and sidebar use the session's personal UUID; workspace content is still synthetic and unsaved.
3. Change the workspace segment in the URL, including back to `ws-personal-01`. Expect **This workspace isn’t available** without profile/editor content. Return through **Go to my workspace**.
4. Stop the auth service, reload/refocus a protected page, and expect recovery without mounted workspace content. Restart and use **Retry session check**. Sign out from `/sign-in` and verify a protected URL redirects there again; test a second tab too.

These guards use React Router 7.18.4's nested [Outlet](https://reactrouter.com/7.18.4/api/components/Outlet) and [Navigate](https://reactrouter.com/7.18.4/api/components/Navigate) APIs. Browser guards are not server authorization; persisted onboarding/private route enforcement remains separate.

Restart `pnpm dev` after the shared package rebuild. Open the app at `http://localhost:3000` in two tabs of the same browser. Sign in with Google, reload both tabs, and check that the sidebar reflects the account while still saying Sample workspace. Sign out in one tab: both should clear the signed-in identity. Session recovery and logout are serialized across these tabs; different browser origins (such as the standalone auth MFE on port 3001) are not a supported shared-cookie workflow.

Stop the auth service and refocus a tab: it should show Session unavailable after its check, clear identity, and offer Retry session check on the sign-in page. Restart the service and retry. A failed sign-out must display Retry sign out; retry after service recovery. No access/refresh credential is placed in localStorage, sessionStorage, or cross-tab messages. Browser tests requiring your real Google session remain manual.

2026-10-01 shell-session verification: an existing authenticated browser session restored in two tabs. The signed-in account badge and disabled LinkedIn credential-waiting state were observed. Fresh Google consent, live cross-tab logout and outage/recovery remain manual checks; synthetic controller tests cover their session-state logic.
