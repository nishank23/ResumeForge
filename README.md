# resume-forge

A planned multi-tenant resume and professional-profile platform for individuals, organizations, and vendors. It tailors resumes to supplied job descriptions without changing the master profile.

**Current stage: Phase 1 in progress — P1.1 toolchain/scaffold and P1.2 shared UI/shell (F01) complete.** Next task: P1.3 persistence and access foundations (F03). The tracker records the current gate and supersedes earlier planning-stage status notes.

## Start here

1. [Context index](context/README.md) — reading order and the complete document map.
2. [Project overview](context/project-overview.md) — product scope, five baseline phases and proposed Phase 6.
3. [Build plan](context/build-plan.md) — dependencies, phase gates, and task plans.
4. [Decisions and open questions](context/decisions.md) — confirmed choices, proposed details, and unresolved requirements.
5. [Project tracker](project-tracker.md) — entry point to the canonical progress record.
6. [Agent instructions](AGENTS.md) — rules for future work in this project.
7. [Frontend integration](context/frontend-integration.md) — Performative UI and reference review.
8. [Contextual editing contract](context/resume-editing-contract.md) — section prompts, review/apply and version behavior.

## Documentation layout

```text
resume-forge/
├── AGENTS.md
├── README.md
├── project-tracker.md
├── context/
│   ├── README.md
│   ├── project-overview.md
│   ├── architecture-context.md
│   ├── ui-context.md
│   ├── code-standards.md
│   ├── ai-workflow-rules.md
│   ├── progress-tracker.md
│   ├── frontend-integration.md
│   ├── resume-editing-contract.md
│   ├── phase-1-decision-review.md
│   ├── decisions.md
│   ├── data-model.md
│   ├── authorization-model.md
│   ├── validation-strategy.md
│   ├── build-plan.md
│   ├── build-plans/           # Context review + six phase plans (Phase 6 proposed)
│   └── feature-specs/         # 20 numbered feature specs (F19/F20 proposed additions)
└── docs/
    ├── source-plan.md         # Supplied plan adapted to this project root
    ├── api-reference.md       # Planned contracts, not implemented routes
    ├── deployment.md          # Planned deployment and readiness checks
    └── mcp-integration.md     # Phase 5 integration contract
```

The project and planned GitHub repository are named `resume-forge`. The layout above uses that canonical name; the existing local checkout directory has not been moved. All documentation and planned implementation paths are relative to this root.

## Stack (verified in P1.1 & P1.2)

pnpm 12 + Turborepo 2; Vite 6 + React 19 + TypeScript 5.9 + `@module-federation/vite` microfrontends (`shell`, `auth-mfe`, `profile-mfe`, `resume-mfe`); Tailwind v4 + shadcn/ui + `performative-ui@0.7.0` wrappers in `@resume-forge/shared`; Hono 4 services on Node.js 22; local PostgreSQL 18 + Prisma 7 (pgvector and hosting deferred); Google/LinkedIn OAuth; Trigger.dev; Vercel AI SDK with Gemini by default; Cloudflare Pages and R2. See [architecture](context/architecture-context.md) and [progress tracker](context/progress-tracker.md) for pinned versions.

## Development

Requires Node.js 22+ and the pinned pnpm 12.6.0. From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://localhost:3000**. The shell opens **My resumes**; all three frontend modules and the gateway start together. Starting only the shell will leave module-backed pages unavailable. Stop with Ctrl+C.

The UI is a sample workspace: create-mode selection, section selection/review/apply, profile validation, themes and responsive navigation are interactive. Changes are local to the mounted preview and reset when leaving it. OAuth, database persistence, AI, scoring and PDF export are not connected. No credentials or `.env` file are needed for this preview.

```bash
pnpm build   # Build all workspace packages
pnpm check   # Lint and typecheck, including dependency builds
```

To inspect built output instead of development servers, stop `pnpm dev`, run `pnpm build`, then:

```bash
pnpm --parallel --filter @resume-forge/shell --filter @resume-forge/auth-mfe --filter @resume-forge/profile-mfe --filter @resume-forge/resume-mfe preview
```

This serves the frontend production builds on ports 3000–3003. The gateway is not required for the sample UI. Shared styles are a built package; after editing them during development, run `pnpm --filter @resume-forge/shared build` and refresh, or restart `pnpm dev`.

See [UI review and verification](docs/ui-redesign-review.md) for the latest changes and manual checks. The 2026-09-29 planning notes below describe earlier stages; the current tracker takes precedence.

### Local PostgreSQL

Install PostgreSQL command-line tools (`initdb`, `pg_ctl`, `psql`, `createdb`, `pg_dump`) on your PATH. Verified with Homebrew PostgreSQL 18.3 and Prisma 7.10.0. From the repository root:

```bash
pnpm db:local:start
pnpm db:migrate
pnpm db:test
pnpm db:local:status
# When finished:
pnpm db:local:stop
```

The dedicated cluster listens only on `127.0.0.1:55432`, uses SCRAM password authentication, and stores data/credentials in ignored `.local/` (do not delete it to reset development). Prisma CLI reads `.local/database.env` automatically; an explicit `DATABASE_URL` overrides it for migrations. Database tests always use the managed local cluster, create disposable test databases, and remove only those databases. Expect seven passing subtests plus their parent test, including rollback and backup/restore checks. `db:local:start` is safe to repeat and preserves data.

This slice adds identity, session, workspace, profile/contact and grant persistence models. It does not connect sample UI, implement OAuth/session rotation, or activate shared workspaces. Local database credentials have administrative privileges for migrations and disposable database tests; restricted service roles are required before private routes use the database. See [database foundation](docs/database-foundation.md).

## Latest planning update

2026-09-29: added Performative UI integration and contextual resume-section prompting to the plan. The proposed flow supports a basic profile-derived resume or JD tailoring, followed by reviewable section changes and explicit version saves. CareerZenith informs resume capabilities only. Visual concepts are paused; no package has been installed or application developed. Remaining decisions, including file intake, are in [decisions](context/decisions.md).

Follow-up: the planned Performative UI use now includes backgrounds, surfaces and accents alongside shadcn/ui. The signed-in reference editor has been inspected through authorized Chrome access; findings and limits are recorded in the frontend integration document.

Latest follow-up: [resume capability coverage](context/resume-capability-coverage.md) maps all identified resume features to owners and phases. Dashboard search/sort/clone/active selection and builder/issue workflows are explicit. Proposed [Phase 6](context/build-plans/06-builder-expansion.md) adds file import and full template/format controls as F19/F20. This supersedes the earlier unallocated intake/template backlog; technical decisions and development approval remain open.

## GitHub preparation

Commit `.gitignore`, `README.md`, `AGENTS.md`, `project-tracker.md`, and all Markdown files under `context/` and `docs/`. The root `.gitignore` excludes local secrets, dependencies, generated output, logs, temporary uploads/exports and local CodeGraph metadata. Sanitized `.env.example` / `.env.*.example` templates and the future pnpm lockfile remain eligible to commit. No blanket Markdown rule is used.

Repository creation and pushing to GitHub are a later step. This naming and repository-hygiene update does not authorize application development.
