# Phase 1 Build Plan — Foundation

**Features:** F01–F04. **State:** Not started. **Goal:** Sign in, enter a private personal workspace, and save a master profile.

## Entry conditions

The user has confirmed context and authorized development. Resolve D06 for UI and validate D13 before Performative UI dependency pinning; D03/D04/D08/D11 for schema/access foundations; D10 for the chosen auth environment. D07 is required before vector migrations. Read [architecture](../architecture-context.md), [data model](../data-model.md), and each linked spec.

## Task P1.1 — Verify the toolchain and scaffold

Planned files: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`; manifests/configs under `apps/`, `services/`, and `packages/`.

- [ ] Check current official/installed documentation for the requested Vite/React/federation, Prisma/Neon, Tailwind, and Trigger.dev combinations; record exact selected versions and any proposed deviation.
- [ ] Create the pnpm/Turborepo workspace with documented package exports and server/browser boundaries.
- [ ] Configure strict TypeScript, lint/typecheck/build scripts and the selected meaningful test runners.
- [ ] Define local service ports, environment categories, and development commands without committing secrets.
- [ ] Verify clean install and production builds from the lockfile; record actual commands in README/tracker.

## Task P1.2 — Shared UI and shell (F01)

Planned files: shared components/tokens, shell router/layout, remote entrypoints.

- [ ] Implement approved design tokens and accessible primitives from [F01](../feature-specs/01-design-system.md).
- [ ] Establish federation contracts, shared React/runtime behavior, route boundaries, and remote failure fallback.
- [ ] Verify a shared component renders consistently in shell and a remote at production-build URLs.

## Task P1.3 — Persistence and access foundations (F03)

Planned files: Prisma models/migrations, shared domain schemas, authorization personal-scope helpers, audit event/outbox contracts.

- [ ] Implement the approved workspace/profile/contact/session model from [F03](../feature-specs/03-database-schema.md).
- [ ] Add constraints, revisions, version/task foundations, tenant indexes, and synthetic fixtures.
- [ ] Add approved vector columns only after D07 validation; avoid guessed dimensions/model names.
- [ ] Establish personal ownership checks and audit capture before exposing private routes.
- [ ] Run migration, scoped-query, constraint, and recovery checks against a development database.

## Task P1.4 — Authentication (F02)

Planned files: auth service/gateway, auth MFE, shell session bootstrap, personal-workspace provisioning path.

- [ ] Implement [F02](../feature-specs/02-auth-oauth.md) provider transactions, session rotation/revocation, and protected routing.
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

- [ ] Verify published version/license/export APIs, React 19/Vite 6/federation compatibility, CSS conflicts and bundle impact before pinning.
- [ ] Add shared PromptHero/Prompt wrappers, target labels, optional toolbar filtering, busy/error guards and accessible comparison primitives using synthetic data.
- [ ] Integrate approved Performative UI background/surface/accent wrappers alongside shadcn/ui; verify contrast, pointer isolation, static fallback, offscreen cleanup and mobile performance.
- [ ] Verify keyboard/IME/touch, focus, reduced motion, chosen themes, shell styles and standalone remote loading.
- [ ] Define stable section/item and proposal/base-version contracts needed by Phase 2 without enabling AI editing in Phase 1.

See [frontend integration](../frontend-integration.md). Final visual choices remain D06; paused concept work is not an approval. No provider requests are part of the F01 UI sample.
