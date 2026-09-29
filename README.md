# resume-forge

A planned multi-tenant resume and professional-profile platform for individuals, organizations, and vendors. It tailors resumes to supplied job descriptions without changing the master profile.

**Current stage: context prepared for review; development has not started.** The user will confirm the context before application scaffolding or implementation begins.

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

## Planned stack

pnpm + Turborepo; Vite + React + TypeScript microfrontends; Tailwind + shadcn/ui + selected Performative UI components; Hono services on Node.js; Neon PostgreSQL + pgvector + Prisma; Google/LinkedIn OAuth; Trigger.dev; Vercel AI SDK with Gemini by default; Cloudflare Pages and R2. Exact version compatibility will be verified during foundation work. See [architecture](context/architecture-context.md).

No resume-forge application code, dependency manifests, credentials, infrastructure, or migrations are created by this documentation stage. Run and deployment commands will be added only after the corresponding implementation exists.

## Latest planning update

2026-09-29: added Performative UI integration and contextual resume-section prompting to the plan. The proposed flow supports a basic profile-derived resume or JD tailoring, followed by reviewable section changes and explicit version saves. CareerZenith informs resume capabilities only. Visual concepts are paused; no package has been installed or application developed. Remaining decisions, including file intake, are in [decisions](context/decisions.md).

Follow-up: the planned Performative UI use now includes backgrounds, surfaces and accents alongside shadcn/ui. The signed-in reference editor has been inspected through authorized Chrome access; findings and limits are recorded in the frontend integration document.

Latest follow-up: [resume capability coverage](context/resume-capability-coverage.md) maps all identified resume features to owners and phases. Dashboard search/sort/clone/active selection and builder/issue workflows are explicit. Proposed [Phase 6](context/build-plans/06-builder-expansion.md) adds file import and full template/format controls as F19/F20. This supersedes the earlier unallocated intake/template backlog; technical decisions and development approval remain open.

## GitHub preparation

Commit `.gitignore`, `README.md`, `AGENTS.md`, `project-tracker.md`, and all Markdown files under `context/` and `docs/`. The root `.gitignore` excludes local secrets, dependencies, generated output, logs, temporary uploads/exports and local CodeGraph metadata. Sanitized `.env.example` / `.env.*.example` templates and the future pnpm lockfile remain eligible to commit. No blanket Markdown rule is used.

Repository creation and pushing to GitHub are a later step. This naming and repository-hygiene update does not authorize application development.
