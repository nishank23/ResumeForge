# Phase 1 Build Plan — Foundation

**Features:** F01–F04. **State:** In progress (P1.1 and P1.2 complete). **Goal:** Sign in, enter a private personal workspace, and save a master profile.

## Entry conditions

The user has confirmed context and authorized development. Resolve D06 for UI and validate D13 before Performative UI dependency pinning; D03/D04/D08/D11 for schema/access foundations; D10 for the chosen auth environment. D07 is required before vector migrations. Read [architecture](../architecture-context.md), [data model](../data-model.md), and each linked spec.

## Task P1.1 — Verify the toolchain and scaffold

Planned files: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`; manifests/configs under `apps/`, `services/`, and `packages/`.

- [x] Check current official/installed documentation for the requested Vite/React/federation, Prisma/Neon, Tailwind, and Trigger.dev combinations; record exact selected versions and any proposed deviation.
- [x] Create the pnpm/Turborepo workspace with documented package exports and server/browser boundaries.
- [x] Configure strict TypeScript, lint/typecheck/build scripts and the selected meaningful test runners.
- [x] Define local service ports, environment categories, and development commands without committing secrets.
- [x] Verify clean install and production builds from the lockfile; record actual commands in README/tracker.

## Task P1.2 — Shared UI and shell (F01)

Planned files: shared components/tokens, shell router/layout, remote entrypoints.

- [x] Implement approved design tokens and accessible primitives from [F01](../feature-specs/01-design-system.md).
- [x] Establish federation contracts, shared React/runtime behavior, route boundaries, and remote failure fallback.
- [x] Verify a shared component renders consistently in shell and a remote at production-build URLs.

## Task P1.3 — Persistence and access foundations (F03)

Planned files: Prisma models/migrations, shared domain schemas, authorization personal-scope helpers, audit event/outbox contracts.

- [ ] Implement the approved workspace/profile/contact/session model from [F03](../feature-specs/03-database-schema.md).
- [x] Add constraints, revisions, version/task foundations, tenant indexes, and synthetic fixtures.
- [ ] Add approved vector columns only after D07 validation; avoid guessed dimensions/model names.
- [x] Establish fail-closed personal workspace/resource ownership checks without activating proposed shared-role mappings.
- [x] Define a content-free, allowlisted audit event-intent contract with scoped identifiers and explicit outcomes.
- [x] Add validated personal-workspace audit capture in the same transaction as domain work; verify rollback and fail-closed contact result delivery.
- [x] Verify bounded local outbox delivery, persisted retry/lease recovery and workspace-owned idempotent personal ingestion.
- [x] Verify authenticated local HTTP audit transport, bounded validation/acknowledgements, timeout/retry and ingestion COMMIT-failure recovery.
- [x] Enforce and verify distinct restricted local auth/profile/relay/ingestor DB roles, minimal onboarding projection, append-only runtime ledger access and guarded startup without admin fallback.
- [x] Verify automatic local audit relay passes with nonoverlap, bounded batches/IO waits, graceful shutdown and durable restart/retry/lease recovery.
- [x] Resolve private-service actors through authenticated local HTTP with minimal session/workspace projection, expiry/revocation checks and unavailable-peer failure; no client identity/role claims or shared roles are trusted.
- [x] Integrate private professional-profile GET/PUT with verified actors, scoped action/ownership checks, revision conflicts, contact-free DTOs and transactional audit; verify fail-closed reads, rollback and owned-workspace denial delivery.
- [ ] Extend private-route policy/capture to contacts and sections; hosted scheduling supervision/runtime roles/production service identity remain deployment prerequisites.
- [ ] Run migration, scoped-query, constraint, and recovery checks against a development database.

## Task P1.4 — Authentication (F02)

LinkedIn is on hold by user request (2026-10-01), pending credentials/configuration. Google/session slices proceed independently. Shell session bootstrap, cross-tab coordination and protected personal routing are implemented; persisted onboarding remains pending.

Planned files: auth service/gateway, auth MFE, shell session bootstrap, personal-workspace provisioning path.

- [ ] Implement [F02](../feature-specs/02-auth-oauth.md) provider transactions, session rotation/revocation, and protected routing.
- [x] Guard shell workspace/onboarding routes, bind selectors to verified personal identity, provide outage recovery and clear mounted content on lost/changed scope.
- [ ] Make identity/workspace provisioning idempotent and recover from partial cross-service failures.
- [ ] Verify real configured provider callbacks and distinguish this evidence from mocked integration tests.

## Task P1.5 — Onboarding (F04)

Planned files: profile service/remote, profile schemas and draft/setup endpoints.

- [ ] Implement [F04](../feature-specs/04-profile-wizard.md) draft/review/complete flow with separate contact handling.
- [ ] Verify reload/retry, empty optional sections, validation, conflicts, and denied cross-user access.
- [ ] Record acceptance evidence and update all four feature statuses accurately.

## Exit gate

All F01–F04 acceptance criteria pass: both configured providers work, a single personal workspace is established, the user saves/reloads a private profile, and unauthorized reads/writes are denied. Record type/lint/build and meaningful integration/browser checks. Organization/vendor access remains inactive until Phase 4.

## Performative UI integration tasks (F01; U01/D13)

- [x] Verify published version/license/export APIs, React 19/Vite 6/federation compatibility, CSS conflicts and bundle impact before pinning.
- [x] Add shared PromptHero/Prompt wrappers, target labels, optional toolbar filtering, busy/error guards and accessible comparison primitives using synthetic data.
- [x] Integrate approved Performative UI background/surface/accent wrappers alongside shadcn/ui; verify contrast, pointer isolation, static fallback, offscreen cleanup and mobile performance.
- [x] Verify keyboard/IME/touch, focus, reduced motion, chosen themes, shell styles and standalone remote loading.
- [x] Define stable section/item and proposal/base-version contracts needed by Phase 2 without enabling AI editing in Phase 1.

See [frontend integration](../frontend-integration.md). Final visual choices remain D06; paused concept work is not an approval. No provider requests are part of the F01 UI sample.

## P1.2 usability follow-up — 2026-09-30

- [x] Inspect the actual screen and repair missing Tailwind app-source utilities and cache inputs.
- [x] Separate product navigation, creation, editing and developer diagnostics; clearly label sample behavior.
- [x] Verify desktop/mobile production UI, keyboard creation modes, profile validation, theme isolation and synthetic remote recovery.

See [review](../../docs/ui-redesign-review.md). P1.3 remains next, gated by the unresolved data/session/audit decisions and a development database target.
