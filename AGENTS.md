# Forge Studio — agent instructions

## Checkout and authorization — 2026-10-14

Work on **feature** in /Users/nishankbansal/Downloads/ResumeBuilderv2 for this organization task. Use remote **organization** (resuming-v2/ResumeForge). Personal **origin** points to nishank23/ResumeForge; do not publish this work there or switch another worktree. Worktree-local Git defaults are configured. Preserve private .env/.local, services, database and credential volumes.

The user approved the first Phase 1 slice on 2026-10-14: saved-resume + pasted-JD full tailoring, review, separate-copy save and PDF, using native pnpm development. [PLAN.md](PLAN.md) defines this bounded work. Master-profile import, URL intake, DOCX, tracker, billing and outreach remain later phases, not blanket implementation authorization. The user subsequently approved Gemini 3.8 Flash for whole-source writing and independent fact/coverage review with bounded correction. Flash-Lite remains for small edits. Existing approved personal functionality stays implemented. The old context-review gate was cleared; do not ask to approve all historical context again.

On 2026-10-15 the user approved guided experience questions, explicit confirmation of additional entry-local facts, and fuller tailoring from those facts. Reuse the existing paid model, version-bound proposal queue and reviewed-copy save. Master-profile import and scoring-rubric changes remain separate scope.

## Read before work

1. [Product plan](PLAN.md), [current audit](docs/implementation-audit.md), [progress](context/progress-tracker.md) and [task ownership](context/development-status.md).
2. [Overview](context/project-overview.md), [architecture](context/architecture-context.md), [UI](context/ui-context.md), [code standards](context/code-standards.md), [workflow](context/ai-workflow-rules.md) and [decisions](context/decisions.md).
3. The task's live domain contracts: [editing](context/resume-editing-contract.md), [authorization](context/authorization-model.md), [data](context/data-model.md), [ATS/Gemini](docs/ats-workflow.md), [frontend](context/frontend-integration.md) and [API readiness](docs/frontend-api-readiness.md).

[Context index](context/README.md) and [technical guides](docs/README.md) identify active documentation. [Historical archives](docs/archive/README.md) are evidence, not current task instructions. README stays limited to product overview, stack, prerequisites, setup and run/build.

## Product and architecture invariants

- Current access is personal. The proposed plan adds personal application tracking, monetization and cover-letter/message drafts in later phases; it does not activate employer hiring workflows or automatic outreach.
- Preserve Individual, Organization and Vendor models and the 27 permission names. Shared access, contact permissions/consent and reserved cover-letter permissions require phase-specific repair and verification before activation.
- Keep UserContact separate from UserProfile. Apply server permissions/privacy to versions, PDFs, exports, tasks, retrieval and future integrations. Authenticate actor/action/resource scope; a client workspace ID is a selector, never authority.
- AI uses supported professional facts only. Never fabricate metrics, tools, qualifications or seniority. Keep personal identity/contacts, source files and OAuth credentials out of provider projections. Reviewed resume changes never silently alter the master profile.
- Keep resume-core free of authentication, workspace, HTTP, ORM and storage. Reuse authorized use cases across REST/future jobs/MCP; recheck access on execution/retrieval.
- Preserve immutable versions, stable editor targets, expected revisions, server-stored proposals, idempotent Apply and atomic audit.

## Execution and UI

Inspect status/diff and task owner; preserve existing changes. Use strict TypeScript, Zod, scoped queries and sanitized logs. Never commit secrets, OAuth tokens or real resume/contact fixtures. Parallel work requires explicit assignments and branch/path ownership; see [workflow](docs/parallel-development.md).

Reuse Vite/React federation, Hono, existing package/service seams, shared Performative/shadcn-style adapters and Tiptap. Preserve accessibility, device theme, reduced motion, real request feedback and document/PDF isolation. CareerZenith is a capability reference, not the visual design.

Legacy generation/JD history/shared routes remain gated. The legacy quantify action no longer fabricates metrics; other legacy suggestions and client-authoritative Apply remain unapproved. The new /tailoring routes use stored proposals and an owned leased metadata queue. Read installed/current official docs for version-sensitive changes; do not silently upgrade. Run relevant checks and record actual results/limitations. Update affected contracts and the current tracker after meaningful work; historical tests are not fresh evidence.

<!-- CODEGRAPH_START -->
## CodeGraph

When a `.codegraph/` directory exists at the repo root, use `codegraph_explore` (or `codegraph explore "<question or symbol>"`) before grep/find or raw file reads to understand or locate indexed code. Name the relevant file or symbol in the query. Use direct reads for documentation/configuration that CodeGraph does not index or when it explicitly reports stale/unavailable content. If there is no index, skip CodeGraph; do not initialize it without the user's request.
<!-- CODEGRAPH_END -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
