# Personal showcase deployment

## Scope and current state — 2026-10-14

The user authorized an isolated `codex/cloud-deploy` worktree from the current personal private GitHub release. This overrides the older frontend checkout rule for this deployment task. The local Docker application, its database, and private configuration remain separate.

The deployed application serves the existing personal resume platform at `https://resumeforge.sugarbuddyai.com`. It does not activate shared workspaces, legacy generation, or future JD-based complete resume generation. Native VM and public browser checks passed below. The organization repository and the original local database remain separate.

## Verified candidate — 2026-10-13

- Production asset build: 15/15 tasks. Lint/typecheck: 34/34 tasks. Workspace regressions: 284/284 cases across 13 suites.
- Linux amd64 app and Nginx images build successfully. Cloud Compose configuration validates.
- Isolated production integration: 8/8 checks, covering static federation, private internal routes, migrations/pgvector, all five restricted roles, synthetic Google identity/refresh, saved versions, cross-owner denial, owner PDF/readiness, reviewed upload/delete/undo, and real outbox delivery.
- The synthetic identity fixture runs inside the test container; it is not fresh real Google sign-in. Actual running APIs are checked for unauthorized denial and readiness. Real provider settings are absent from this test project.
- Startup checks found and fixed YAML tmpfs quoting and Nginx default temporary paths on the read-only filesystem. The non-root web container now becomes healthy.
- App image checks confirm `.env`, `.local`, `.git`, resume fixture directories, and provider environment values are absent. The approved private image/configuration bundle and selected existing provider settings were transferred with matching checksums. The local database is excluded.

## Live deployment verification — 2026-10-14

- The verified bundle was staged on the persistent boot disk. Debian `/tmp` is a 483 MiB RAM filesystem on this VM and filled during the first extraction; partial files were removed and the intact bundle was relocated without changing any database volume.
- Initial parallel startup caused restricted-role checks to fail during disk/memory contention: seven restarts, no OOM kill, and 36–46% I/O wait. Isolated role probes passed in 65–275 ms with the existing 3-second timeout. No role grants or query timeout were weakened.
- Cloud startup now waits for each private service to bind before launching the next and starts the audit worker after its recipient. The supervisor imports pure runtime configuration instead of loading the full ORM. Shutdown aborts readiness waits; an unbound service fails within 60 seconds. Native/local Docker keeps parallel startup.
- Revised helper tests passed **5/5**, covering delayed binding, cancellation, timeout and credentials. The revised Linux amd64 image passed the isolated **8/8** production integration again. The same three runtime files were applied to the VM as a checksum-verified thin image layer; the original image tag is retained as `forge-studio:cloud-baseline` for rollback.
- Native startup completed in about 105 seconds. After ordinary public save/reload, PDF export, PDF upload and scoped AI checks, the app remained healthy with **zero restarts** and no OOM. Deployment startup is distinct from request handling; Docker and cloudflared remain enabled without an idle suspension policy.
- Physical RAM is 964 MiB. Before browser tests, app resident/cached memory was about 209–243 MiB, including about 350 MiB swapped app memory. After save/PDF/AI checks, Docker reported app 332.4 MiB, database 38.51 MiB, web 2.145 MiB; host available RAM was 231 MiB and total used swap was 443 MiB. Swap is actively used. These checks do not establish performance for large files, heavy concurrency or sustained load.
- Private origin health returned 200 in about 4 ms; warmed anonymous profile/resume requests returned 401 in 7–154 ms. External HTTPS checks over IPv4 returned health 200 in 0.88 seconds, private API 401 in 0.36–0.43 seconds, all three federated entries 200 in 0.84–0.90 seconds, and internal auth 404. These are individual observed timings, including client/network latency, not a service-level guarantee.
- The operator added the Cloudflare published route to `http://localhost:8080`. Public HTTPS rendered the authenticated Google-backed personal workspace. The existing session and saved resume were observed, then a separate clearly synthetic resume was created as version 2 and retained after a full HTTPS reload. The agent did not replay the operator's Google account-selection step or alter the operator's existing resume.
- Saved-version PDF downloaded as an actual 11,303-byte, one-page document. Text extraction and page rendering passed. Reuploading that synthetic PDF showed the reviewed draft, preserved its extracted name/headline/summary, and saved version 1 only after confirmation; reload retained it. Two clearly named synthetic test resumes remain in the account.
- A live scoped Gemini request containing only fictional summary text completed with “No changes needed.” No contact fields or real resume content were sent by that test; no fabricated change was applied. This is provider-path evidence, not validation of every AI feature or future complete JD generation.
- Server-only provider configuration is root-owned mode 0600. Nginx publishes only `127.0.0.1:8080`; the database has no host port. The private backup helper restored and verified two fresh dumps, including one after public flow tests, and a matching private copy is stored off the VM as described below.

## Runtime

- Google Compute Engine e2-micro in us-central1-a: 1 GB physical RAM, 30 GB standard boot disk, no external IPv4.
- Existing cloudflared service connects over IPv6 and starts automatically. Only IAP SSH is allowed into the VM.
- Nginx serves the four built frontend bundles. Vite preview processes do not run in production. The frontend uses same-origin API routes and remote bundles under `/mfe/`.
- The existing gateway, auth, profile, resume, audit recipient and audit worker remain supervised Node processes. Cloud startup is sequential; child failure stops the app container so Docker can restart it.
- Production requires `RESUME_FORGE_RUNTIME=cloud`, `NODE_ENV=production`, and one canonical HTTPS `FORGE_PUBLIC_ORIGIN`. Native/local production configurations remain rejected.
- OAuth cookies use Secure, HttpOnly and SameSite=Lax. Origin validation follows the configured hostname. Internal actor and audit routes remain inaccessible through the public web server.
- PostgreSQL/pgvector has no published port. A private backend Docker network separates it from the web container. Bootstrap applies the existing migrations and verifies all five restricted roles.
- The non-root app receives only runtime credentials. The administrator volume is available only during provisioning and isolated tests. Provider settings reach only their owning child service.
- Persistent credential and database volumes survive restarts. Do not delete volumes to repair a failed startup.

The app has a 640 MiB container memory limit and a bounded swap allowance. PostgreSQL has a 160 MiB limit; Nginx has a 32 MiB limit. The VM has a 1 GiB swapfile. Ordinary showcase flows passed with active swap as measured above; concurrent uploads/PDFs remain unmeasured.

## Build and isolated verification

Use the checked lockfile and digest-pinned images. No server secrets belong in the build arguments.

```sh
FORGE_PUBLIC_ORIGIN=https://resumeforge.sugarbuddyai.com pnpm build --concurrency=2
FORGE_PUBLIC_ORIGIN=https://resumeforge.sugarbuddyai.com pnpm check --concurrency=2
FORGE_PUBLIC_ORIGIN=https://resumeforge.sugarbuddyai.com pnpm test --concurrency=2
FORGE_PUBLIC_ORIGIN=https://resumeforge.sugarbuddyai.com docker compose -f compose.cloud.yaml build app web
```

The VM is Linux amd64; the cloud Compose file fixes that platform. Before the synthetic integration run, create the external `resumeforge-cloud` network with IPv6 enabled if it does not exist.

```sh
FORGE_PUBLIC_ORIGIN=https://resumeforge.sugarbuddyai.com docker compose -p resumeforge-cloud-check -f compose.cloud.yaml -f docker/compose.cloud.test.yaml up -d app web
FORGE_PUBLIC_ORIGIN=https://resumeforge.sugarbuddyai.com docker compose -p resumeforge-cloud-check -f compose.cloud.yaml -f docker/compose.cloud.test.yaml run --rm test
```

This test project publishes no host ports and uses its own disposable volumes. Delete only `resumeforge-cloud-check` test resources after recording the results. Never apply a volume deletion to `resumeforge-demo` or the user's local app.

## VM startup and public route

Transfer the validated image artifacts and deployment configuration after approval. Do not copy the local database, resume fixtures, `.local`, Git metadata or a full private `.env`.

The server-only provider file must contain `FORGE_PUBLIC_ORIGIN`, the existing Google OAuth client ID/secret, and optional paid Gemini key/mode. Store it outside the repository with mode 0600. Do not print it, put it into shell history, include it in backups of public source, or commit it.

```sh
sudo docker compose --env-file /etc/resumeforge/provider.env -f compose.cloud.yaml up -d
sudo docker compose --env-file /etc/resumeforge/provider.env -f compose.cloud.yaml ps
curl --fail http://127.0.0.1:8080/api/v1/health
```

The existing Google OAuth web client lists this additional callback alongside the local callback. The console showed “OAuth client saved”; the public Google-backed authenticated session was observed and retained after reload:

```text
https://resumeforge.sugarbuddyai.com/api/v1/auth/google/callback
```

The existing OAuth audience remains External/Testing. Source requests only `openid`, `profile`, and `email`. Google's [basic-identity exception](https://support.google.com/cloud/answer/15549945?hl=en) allows those requests without a test-user allowlist. No publishing-status or scope expansion is part of this deployment.

After the origin passed its private checks, the user added a published application route to the named Cloudflare tunnel: hostname `resumeforge.sugarbuddyai.com`, service `http://localhost:8080`. Do not publish internal ports or the database. Cloudflare account/domain changes remain user-operated.

## Private backup verification

`docker/backup-cloud.sh` is installed as `/usr/local/sbin/resumeforge-backup`, root-owned mode 0700. Two manual VM runs passed, including after public browser checks. Run with sudo while no edits are in flight. It creates a custom PostgreSQL dump, archives both private credential volumes and provider/configuration files, restores the dump into a temporary verification database, and compares migration/user/resume/version counts and pgvector. It then removes only that verification database.

The archive and checksum remain root-only under `/var/backups/resumeforge`. They contain private data and credentials; never commit or publicly share them. The post-test archive was downloaded through IAP to the original checkout's ignored `.local/cloud-backups/` directory (directory 0700, archive/checksum 0600). Its SHA-256 matches the VM copy. That off-VM copy is a point-in-time recovery copy; future edits need new backups. No automatic backup schedule, retention period or purge policy is configured by this helper.

## Remaining operational limits

[Live concurrency checks](cloud-concurrency-2026-10-14.md) now cover five and ten isolated API users. Five-user ordinary work passed 120/120 requests (successful p95 681 ms). Ten-user ordinary work returned two 503s among 194 requests; eight users completed all cycles. PDF, parsing and AI each have a two-operation guard; simultaneous heavy bursts returned busy failures, and the ten-user PDF/upload sequence also had late failures with high I/O wait. No app restart/OOM was recorded. Queue/backpressure and memory/I/O tuning remain needed before claiming reliable five- or ten-user heavy workloads. No runtime bounds or product code were changed by those checks.

Maximum-size uploads, sustained/soak use, simultaneous full browser flows and complete restart/disaster-recovery rehearsal remain unmeasured. Backup scheduling/retention remain unconfigured. The personal repository now uses the verified [CI/CD pipeline](ci-cd.md); the first automated release passed on 2026-10-15. The operator's live Google-backed session was verified, but account selection was not replayed by the agent.

The $2.50 monthly Compute Engine budget sends alerts; it is not a spending cap. Free-tier eligibility is shared across the billing account. Egress, AI calls and other resources can add charges.

Provider references: [Google Cloud free tier](https://docs.cloud.google.com/free/docs/free-cloud-features), [network pricing](https://cloud.google.com/vpc/network-pricing), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), [Vite production build](https://vite.dev/guide/build.html).
