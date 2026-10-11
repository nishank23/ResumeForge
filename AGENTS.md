# resume-forge — Agent instructions

## Current checkout and authorization — 2026-10-11

Use **docker-setup** in /Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2 for commands, edits, task claims and checks. This supersedes fixes and historical codex/frontend, codex/backend, features and ux-ui-update branch instructions. The user requested the full local Docker app on docker-setup. Do not implement in main, switch another agent's checkout or recreate retired branches.

The original /Users/nishankbansal/Downloads/ResumeBuilderv2 is the detached primary runtime/configuration checkout. Preserve its private .local files, services and database. Worktrees do not isolate database roles, API contracts or dependency conflicts. New parallel assignments require explicit branch/path ownership and one integration owner. See [workflow](docs/parallel-development.md).

The context-review gate was cleared on 2026-09-29. Subsequent user instructions authorized the personal resume-first app and its current AI/UI slices. Do not ask for overall context approval again or rerun initial scaffolding. Resolve genuinely open decisions only at their dependent boundaries. A proposed future capability is not permission to execute every phase.

## Read before working

1. [Project overview](context/project-overview.md).
2. [Architecture](context/architecture-context.md).
3. [UI context](context/ui-context.md).
4. [Code standards](context/code-standards.md).
5. [Workflow rules](context/ai-workflow-rules.md).
6. [Progress tracker](context/progress-tracker.md) and [implementation audit](docs/implementation-audit.md).
7. [Decisions](context/decisions.md), [feature/phase register](context/build-plan.md) and the relevant domain contract.

The [context index](context/README.md) identifies canonical documents. Source plans, handoffs and old verification logs are historical; current audit headers and source supersede their activation claims. Task state lives in [context/development-status.md](context/development-status.md), not README.

## Product and architecture invariants

- Build resume/profile management. Exclude job boards, applicant pipelines, interviews, offers and hiring workflows. User-supplied JDs are tailoring inputs.
- Preserve Individual, Organization and Vendor models. Only personal access is currently connected; do not activate shared routes without repairing the audit's policy/runtime/consent gaps.
- Keep UserContact separate from UserProfile. Server permissions and field privacy must cover saved versions, PDFs, exports, tasks and MCP.
- Authenticate actor, membership, action and resource scope. A client workspace ID is a selector, never authority.
- AI may rewrite supported visible facts and confirmed resume-local content only. Never invent qualifications or modify master profile, unrelated sections or protected contacts.
- Keep packages/resume-core free of authentication, workspace, HTTP, ORM and storage.
- Reuse authorized use cases across REST, future jobs and MCP; recheck access at execution/retrieval.
- Preserve the 27 permission names. Cover-letter permissions remain reserved and inactive.

## Frontend and contextual editing

Use Vite/React federation and Hono services with existing package boundaries. Read [frontend integration](context/frontend-integration.md), [editing contract](context/resume-editing-contract.md) and [capability coverage](context/resume-capability-coverage.md) before related changes.

Performative UI adapters, shadcn-style controls and Tiptap are implemented. Preserve accessibility, reduced motion, theme behavior and document/PDF isolation. CareerZenith is a capability reference; create original app visuals and omit private account/resume data from reference evidence.

Reviewed import, three saved template styles, local readiness/JD scoring, paid Gemini scoped rewriting and private 768-dimensional retrieval are bounded implementations, not full roadmap completion. Keep legacy generation/JD-history/shared-workspace exposure gated until their contracts pass.

## Execution and reporting

- Inspect status/diff and task owner; preserve existing changes.
- Follow dependencies and the authorized slice rather than feature-number order.
- Use strict TypeScript, boundary validation, scoped queries, sanitized logs and atomic audit.
- Never commit secrets, OAuth tokens or real resume/contact fixtures.
- Check installed docs and current official provider docs for version-sensitive changes; do not silently upgrade.
- Run relevant checks and record actual commands/results/limitations. Dated tests are not fresh evidence.
- Update the tracker and affected specs/contracts after meaningful work. Mark completed capabilities precisely; schema/spec presence does not complete a product feature.
- Keep product README limited to overview, stack, prerequisites, setup and run/build.

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
