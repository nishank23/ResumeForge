# resume-forge — Agent Instructions

## Scope and current gate

These instructions govern the standalone resume-forge project rooted here. All required product context, feature specifications, and build plans live in this workspace.

The user authorizes planning/context documentation and the requested project naming and `.gitignore` preparation. **Wait for the user's confirmation that context is complete and development may begin before scaffolding apps, installing dependencies, generating application configs, implementing features, migrating data, or provisioning services.** A checklist in a plan is future work, not authorization to execute it now. Later explicit user instructions can change this gate; record that change in the tracker.

This project uses **Vite + React** microfrontends and **Hono** services. Follow the package boundaries, routing conventions, authentication model, and storage choices documented for resume-forge.

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
