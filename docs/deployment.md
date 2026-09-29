# Planned Deployment

**Planning only. No environments have been provisioned.** The user will confirm context before development starts. Provider setup and exact commands will be documented after the selected versions and accounts are verified.

## Target topology

| Component | Destination | Configuration still needed |
|---|---|---|
| Shell, auth/profile/resume remotes | Cloudflare Pages | Projects, domains, remote manifests, SPA fallbacks, cache policy |
| Gateway and five domain services | Node.js container platform | D10 host/region, internal network, ingress, scaling and health checks |
| PostgreSQL + pgvector | Neon | Separate environments, connection/adapter setup, migrations, backups |
| Durable tasks | Trigger.dev | Project/environments, worker deployment, model/storage connections, concurrency |
| PDFs and import artifacts | Private Cloudflare R2 | Buckets, scoped credentials, lifecycle cleanup, URL expiry |
| OAuth | Google + LinkedIn applications | Verified redirects/scopes, secrets, environment-specific callback/session policy |
| AI/embeddings | Vercel AI SDK adapters; Gemini default for generation | Explicit model IDs, compatible dimensions, limits and fallback behavior |

Workers portability is future-facing. Do not deploy Node.js/Prisma/PDF services as Cloudflare Workers without a separate compatibility evaluation. Server hosting remains open; frontend Pages hosting does not answer it.

## Configuration categories

Document concrete names in `.env.example` only during approved scaffolding. Planned categories: database connections; provider client IDs/secrets; JWT signing/session configuration; internal service credentials/addresses; frontend gateway and remote URLs; Trigger.dev project/secrets; AI model/embedding settings; R2 account/bucket credentials; allowed origins/redirects; audit/retention/limits.

Public Vite configuration contains only public URLs/settings. Keep OAuth/AI/R2/database/signing secrets server-side. Use distinct development, staging, and production credentials. Never fill documentation with actual tokens or production contact data.

## Build and deployment order after implementation

1. Verify pinned dependency compatibility and produce reproducible package/service/remote builds.
2. Apply reviewed backwards-compatible migrations with backup/recovery readiness.
3. Deploy domain services and gateway with internal authentication and health checks.
4. Deploy workers against compatible contracts; run a scoped synthetic pipeline smoke test.
5. Deploy remotes and shell using compatible manifest versions; verify remote-failure fallback and SPA routing.
6. Verify auth redirects/session/CORS behavior at real environment domains.
7. Check private object access, signed-link expiry, audit ingestion, and rollback paths before enabling users.

Exact container manifests, CI jobs, package scripts, and CLI commands are future deliverables, not assumed to exist.

## Operations and release gates

Correlate gateway requests, internal calls, task runs, and audit events without logging raw profiles/JDs/contacts. Track generation failure/latency, provider rate/cost limits, dispatch backlog, artifact errors, and audit-delivery backlog. Define alerts and incident recovery before production.

Use bounded timeouts/retries and per-user/workspace abuse limits. Confirm database restore, migration rollback/forward recovery, artifact cleanup, secret rotation, session revocation, and remote-version rollback. Retention for profile/resume/import/audit data is an explicit D11 decision.

Phase 3 may support an individual release once its gate and operational checks pass. Phase 4 shared workspaces remain disabled until consent, RBAC/privacy, and audit gates pass. No deployment is authorized by this documentation task.

## Performative UI and editing release checks

Before release, verify the pinned Performative UI export/style loading across shell and independently built remotes, token/CSS ordering, bundle cost, reduced-motion behavior and remote rollback. It is a bundled frontend dependency, not a new hosted AI service or runtime CDN requirement. See [integration](../context/frontend-integration.md).

Section suggestions reuse existing server AI/Trigger.dev infrastructure. Define request/output limits, rate/cost limits, private proposal retention, cancellation/discard handling and conflict recovery; monitor only safe identifiers/status. Include proposal revocation and exact-version Apply/export in staging checks. No provider keys or prompt content enter public configuration, URLs or logs.

## Proposed Phase 6 operational gate

F19 requires private staging retention, purpose-bound uploads, isolated parser execution with resource/time limits, approved processing location, rate/size quotas and orphan cleanup. Review dependency/parser security and font licenses against official current documentation during implementation. F20 requires deterministic packaged font/render versions and cache identities including render settings/privacy variant. No parser/provider, infrastructure or extra package is installed by these plans.
