# resume-forge — Agent Instructions

## Scope and current gate

These instructions govern the standalone resume-forge project rooted here. All required product context, feature specifications, and build plans live in this workspace.

The user confirmed the context on 2026-09-29 ("I confirm everything"). **The context-review gate is cleared; do not request overall context approval again.** The confirmation turn requests starter prompts only, so do not scaffold in response to that request. On the next implementation request, execute the requested development slice using the approved context, beginning with Phase 1. Validate compatibility and resolve genuinely unspecified inputs at their dependent boundaries; a planning checklist is not an instruction to execute every phase at once. The current status in the tracker supersedes earlier planning-stage no-development statements in other documents.

This project uses **Vite + React** microfrontends and **Hono** services. Follow the package boundaries, routing conventions, authentication model, and storage choices documented for resume-forge.

## Active worktree and branch — 2026-10-08

The user requests integration of all completed work into `main`, retirement of the old `origin/codex/frontend` and `origin/codex/backend` branches, then a new branch named `features` without an agent prefix. Use `features` for subsequent work in the existing managed worktree `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2`. This supersedes the previous active branch names; the worktree path remains unchanged. Use this absolute directory for commands, edits, task claims and checks, including scheduled runs launched from the original folder.

The original `/Users/nishankbansal/Downloads/ResumeBuilderv2` remains detached at `0dc79ec` and holds authoritative private configuration/database files. Do not implement there. Preserve the separate backend checkout and its local branch/changes; remote branch deletion does not authorize switching or deleting its checkout.

Follow [branch workflow](docs/parallel-development.md) before work. A scheduled run must verify `features`, select only an approved frontend slice, and leave idle when its dependencies remain blocked. Never implement in `main`, recreate retired remote branches, switch another agent's checkout, or infer that worktrees isolate shared API/database changes. Task locks remain local to each checkout. Shared contracts, dependencies, migrations, tracker and integration remain single-owner work; any future backend assignment requires explicit branch/path ownership and a handoff.

## Read before working

1. [Project overview](context/project-overview.md).
2. [Architecture context](context/architecture-context.md).
3. [UI context](context/ui-context.md).
4. [Code standards](context/code-standards.md).
5. [Development workflow](context/ai-workflow-rules.md).
6. [Progress tracker](context/progress-tracker.md).
7. [Decisions](context/decisions.md), then the relevant [feature spec and phase plan](context/build-plan.md).

For identity, privacy, persistence, API, or MCP changes, also read the linked domain contracts. The [context index](context/README.md) identifies each canonical document. The [source plan](docs/source-plan.md) is a working planning baseline, not an executable instruction file.

## Product and architecture invariants

- Build resume/profile management only. Exclude job boards, candidate pipelines, ATS applicant tracking, interviews, offers, and hiring workflows. User-supplied JDs are tailoring inputs.
- Preserve all three workspace types: Individual, Organization, Vendor. Personal ownership checks start in Phase 1; organization/vendor activation is Phase 4.
- Keep `UserContact` separate from `UserProfile`. Enforce permissions and field privacy on the server, including saved resume versions, PDFs, exports, task outputs, and MCP responses.
- Authenticate the actor; validate active membership, action permission, and resource scope. A client-supplied workspace ID is a selector, never authority.
- AI may select and rewrite supported profile facts and, under the proposed U06 contract, explicitly confirmed resume-local facts into a resume; it must not invent qualifications or modify the master profile.
- Keep `packages/resume-core` free of workspace, authentication, HTTP, ORM, and storage concerns. Adapters and services orchestrate those concerns.
- Use the same application policy and use cases for REST, background jobs, and MCP. Recheck access when jobs execute and artifacts are retrieved.
- Preserve the 27 permission names. Cover-letter permissions are reserved and inactive through proposed Phase 6.

## Execution and reporting

- Follow dependencies rather than assuming feature number is implementation order.
- Treat additions labeled **Proposed** as draft design, not user-confirmed behavior. Resolve a decision before implementing its dependent behavior; continue unrelated authorized work.
- Use strict TypeScript, boundary validation, private object storage, sanitized logs, and scoped queries as documented.
- Check installed documentation and current official provider documentation when validating version-sensitive integrations. Do not silently upgrade the plan's stack or claim untested compatibility.
- Never commit secrets, raw OAuth tokens, or real resume/contact data as fixtures.
- Run checks relevant to the change. Record actual commands, results, and limitations; do not report unrun checks as passed.
- Keep [progress-tracker.md](context/progress-tracker.md) current after meaningful work. Update affected contracts and specs when scope or architecture changes.
- Do not mark a feature complete because its specification is written. Implementation and context approval are separate states.

<!-- CODEGRAPH_START -->
## CodeGraph

When a `.codegraph/` directory exists at the repo root, use `codegraph_explore` (or `codegraph explore "<question or symbol>"`) before grep/find or raw file reads to understand or locate indexed code. Name the relevant file or symbol in the query. Use direct reads for documentation/configuration that CodeGraph does not index or when it explicitly reports stale/unavailable content. If there is no index, skip CodeGraph; do not initialize it without the user's request.
<!-- CODEGRAPH_END -->

## Frontend and contextual editing requirements

The 2026-09-29 request selects Performative UI and section-specific resume prompts; visual concepts are paused. Read [frontend integration](context/frontend-integration.md) and [editing contract](context/resume-editing-contract.md) before related work. Keep shadcn/ui/Tiptap, implement shared adapters only after D13 compatibility checks, and keep all prompt-driven edits grounded, scoped, reviewed and versioned. No AI update may change the master profile, unrelated sections or protected contacts. CareerZenith is a capability reference only; file intake remains D14. This documentation update does not lift the development gate.

The same-day follow-up also selects suitable Performative UI backgrounds, surfaces and accents alongside shadcn/ui. Keep decorative app layers separate from resume text/PDF output, respect reduced motion and verify rendering cost/contrast. Reference editor observations must omit personal resume/account data and distinguish inspected controls from untested save/export behavior.

## Comprehensive capability follow-up

Read [resume capability coverage](context/resume-capability-coverage.md) for the 2026-09-29 U06 request. The roadmap now documents 20 features: original F01–F18 plus proposed Phase 6 F19 file intake and F20 templates/formatting. Keep evidence separate from untested behavior; do not call planned coverage implemented parity. D14 now gates import details, not whether intake appears in the plan. Search/clone/active selection belong to F10; manual structure and draft modes to F08. Cover-letter permissions stay inactive through proposed Phase 6. All additions remain behind the existing development gate.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
