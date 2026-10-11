# Local full app Docker setup

The root [README](../README.md) contains installation and provider configuration. This setup runs the current personal app, not the unbuilt shared-workspace or hosted production roadmap.

## Runtime boundary

- `credentials` generates administrator, five runtime-role and two internal-service credentials once.
- `database` runs digest-pinned PostgreSQL 18/pgvector 0.8.7, using the generated password file and a healthcheck.
- `bootstrap` waits for database readiness, deploys the existing migrations, provisions the existing grants and verifies all five runtime identities. It stops on failure with a sanitized stage/code.
- `app` runs the built shell/auth/profile/resume MFEs, four Hono services, audit-only recipient and outbox worker. One supervisor stops the app if a child exits; Compose can restart it. This preserves existing loopback HTTP policy between services.
- Only shell/remotes/gateway/browser auth ports are published, bound to host loopback. PostgreSQL, profile, resume and audit stay internal.
- Docker mode permits only `database:5432/resume_forge_dev` with the existing service-specific role and generated 256-bit password. Native mode still permits only `127.0.0.1:55432/resume_forge_dev`. Production mode remains rejected.

Three named volumes retain database data, administrator credentials and runtime credentials. The application mounts only runtime credentials, read-only; it never receives the administrator volume. Docker uses a separate database from native `.local/postgres`. No existing data is automatically imported.

The image contains locked dependencies and built assets. It uses Vite preview for the local demonstration. It does not provide hot reload or production deployment. Database backups, hosted TLS, distributed sessions, credential rotation and shared-workspace activation remain separate work.

## Browser address

Use `http://localhost:3000`. Google callbacks, auth cookies and the allowed browser origin all use `localhost`. Docker Desktop may show `http://127.0.0.1:3000`; the shell redirects that exact local address to `localhost` before checking the session, preserving the route/query/fragment. Other ports and deployed hosts are unchanged. Auth continues to reject refresh requests from the IP origin.

## Environment and private files

Root `.env` supplies only Google and optional Gemini settings through Compose. It is not copied into the image. Neither `.local`, Git history, user `check_resumes`, private keys nor host dependency/build caches enter the allowlisted build context. Use `docker compose config --quiet` for validation; expanded configuration includes provider values and should remain private.

The pinned base images publish Linux amd64 and arm64 variants. Windows runs Linux containers through Docker Desktop/WSL2. Actual Windows execution must be distinguished from Linux-container testing on macOS.

## Isolated verification

Use the test override and its own project name. It publishes no host ports, supplies no real provider credentials and retains only synthetic data in disposable test volumes.

```sh
docker compose -p forge-docker-test -f compose.yaml -f docker/compose.test.yaml config --quiet
docker compose -p forge-docker-test -f compose.yaml -f docker/compose.test.yaml run --build --rm test
```

The checks target runs workspace lint/typecheck, all configured non-database tests, task/config helpers and Docker credential tests. The integration runner checks the running built MFEs/APIs, fresh migrations, pgvector, restricted-role verification/denials, synthetic Google callback/refresh/actor resolution, version saves/reload/conflicts, ownership, PDF rendering, local readiness, upload review, delete/undo and real audit delivery. It does not call Google or Gemini.

After the run, stop and remove only disposable test data:

```sh
docker compose -p forge-docker-test -f compose.yaml -f docker/compose.test.yaml down --volumes
```

Never use `down --volumes` on the normal project if you want to retain resumes. Normal `docker compose down` preserves its data.

## Manual checks

1. Start the normal app using README instructions; wait until app/database are healthy.
2. Continue with Google. Confirm My resumes opens without profile onboarding.
3. Upload a test resume, review fields, save, edit one field and save again.
4. Reload, then run `docker compose down` followed by `docker compose up -d --wait`. Confirm the saved document remains.
5. Download its PDF and verify content. Check delete confirmation and Undo.
6. Optional paid Gemini: request a selected-entry rewrite, review the diff and Apply. Check JD analysis separately.
7. Run `docker compose logs --tail=80 bootstrap app` if startup fails. Check the reported stage without posting credentials.

## Verification evidence

Verified on **docker-setup**, Docker Engine 29.4.0 / Compose 5.1.1, Linux aarch64 containers on macOS:

- `docker build --check .`: passes, no warnings.
- Both normal and isolated `docker compose ... config --quiet`: pass. Parsed configuration confirms host-loopback publishing, no test host ports, blank test provider settings and no administrator mount in the app.
- The isolated `run --build --rm test` command above: passes. Frozen dependency installation, **15/15 build tasks**, **34/34 lint/typecheck tasks**, **276/276 workspace tests** across 13 suites, **9/9 helper/credential tests**, and **8/8 integration tests** including the parent test.
- Fresh PostgreSQL 18 migrations and pgvector 0.8.7 work. All five restricted identities verify; resume-role contact/OAuth/master-profile denials remain enforced.
- Temporary Chromium/Playwright in the disposable app container: built federated sign-in renders without browser errors. A fictional provider callback creates a test session; the actual Docker auth service refreshes it. The browser opens My resumes, creates a resume through the real gateway, opens the builder, reloads and returns to the library without errors. No browser dependencies were added to the repository or runtime image.
- Test-project `down` then `up -d --wait --wait-timeout 180 app`: healthy. Before/after snapshots match for **7 synthetic resumes**, **10 immutable versions** and all generated credentials.
- Terminating the test profile-service child stops the app with exit code 1; explicit Compose restart restores health.
- Eight original native frontend/API endpoints still return their expected statuses through localhost. Their processes, configuration and database were not changed by Docker setup. The native frontends listen on IPv6 loopback.
- Disposable test containers/volumes were removed afterward. Whitespace validation passes.

Initial verification caught copied owner-only source permissions and an incorrect test hostname. The runtime image now makes public build files readable to its non-root user, while generated credential permissions remain private; tests share the app network namespace and use real localhost URLs. A transient Docker Desktop daemon stop was recovered without resetting data; build/check concurrency is bounded at two tasks.

### IP-link session repair — 2026-10-11

Anonymous headless Chrome reproduced the user's session-error screen at `127.0.0.1:3000`. The scoped shell redirect now preserves route/query/fragment, completes before auth refresh and renders the built federated sign-in page without browser errors; reload passes too. Shell tests **18/18**, lint and TypeScript pass, and the Docker rebuild completes **15/15** tasks. Existing app/database remain healthy after recreation; aggregate resume/version counts and generated credential hashes are unchanged. Origin checks still return 401 for anonymous localhost and 403 for the IP origin. Google authorization setup returns 200; the user's real Google sign-in was not performed.

### Release verification — 2026-10-11

Fresh Dockerfile checks complete without warnings; both Compose configurations pass. The checks image passes **34/34** lint/typecheck tasks, **279/279** workspace tests across 13 suites and **9/9** helper/credential tests. The isolated full-app integration passes **8/8** on fresh synthetic test volumes. Disposable test resources are removed afterward; the normal app/database remain intact. The publication candidate excludes actual environment values, private/generated files and binary resumes. This verification does not add live provider or Windows execution evidence.

**Limits:** Windows Desktop/WSL2 and Linux amd64 were not executed. Live Google OAuth and paid Gemini calls were not repeated for this packaging change. The manual steps above verify those with your own private settings. This does not approve hosted production or shared-workspace routes.
