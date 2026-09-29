# Context Index

**Readiness:** Prepared for user review. These documents describe intended behavior; they do not indicate implementation or user approval.

## Reading order

1. [Project overview](project-overview.md) — goals, users, scope, phases.
2. [Architecture context](architecture-context.md) — services, microfrontends, packages, invariants.
3. [UI context](ui-context.md) — proposed visual direction and product flows.
4. [Code standards](code-standards.md) — future implementation conventions.
5. [AI/development workflow rules](ai-workflow-rules.md) — how work proceeds after approval.
6. [Progress tracker](progress-tracker.md) — actual status and evidence.
7. [Decisions](decisions.md) — confirmed baseline, reconciliations, proposals, unresolved questions.
8. [Master build plan](build-plan.md) — dependency order and phase execution plans.
9. [Phase 1 decision review](phase-1-decision-review.md) — plain-language foundation recommendations; visual concept selection paused.
10. [Frontend integration](frontend-integration.md) — selected Performative UI components, source evidence and compatibility gate.
11. [Contextual editing contract](resume-editing-contract.md) — basic builder, section prompts, review/apply and version integrity.

12. [Resume capability coverage](resume-capability-coverage.md) — observed features, explicit owners, phase allocation and unknowns.

## Domain and integration contracts

- [Data model](data-model.md) — source entities, proposed supporting models, constraints and privacy.
- [Authorization model](authorization-model.md) — all 27 permissions, proposed complete role mapping, field policy.
- [Validation strategy](validation-strategy.md) — context checks and meaningful future test/release gates.
- [API reference](../docs/api-reference.md) — planned routes, ownership, validation and error contracts.
- [Deployment plan](../docs/deployment.md) — topology, unresolved hosting choices, future readiness checks.
- [MCP integration](../docs/mcp-integration.md) — Phase 5 tools and REST policy parity.

## Phase build plans

- [00 — Context review](build-plans/00-context-review.md)
- [01 — Foundation](build-plans/01-foundation.md)
- [02 — AI pipeline](build-plans/02-ai-pipeline.md)
- [03 — Complete individual flow](build-plans/03-individual-flow.md)
- [04 — Multi-tenant](build-plans/04-multi-tenant.md)
- [05 — Advanced](build-plans/05-advanced.md)
- [06 — Resume builder expansion](build-plans/06-builder-expansion.md) — proposed

## Feature specifications

- [01 — Design system](feature-specs/01-design-system.md) — Phase 1
- [02 — Google + LinkedIn OAuth](feature-specs/02-auth-oauth.md) — Phase 1
- [03 — Database schema + Prisma](feature-specs/03-database-schema.md) — Phase 1
- [04 — Individual profile wizard](feature-specs/04-profile-wizard.md) — Phase 1
- [05 — JD parser](feature-specs/05-jd-parser.md) — Phase 2
- [06 — Resume generator](feature-specs/06-resume-generator.md) — Phase 2
- [07 — ATS scoring + breakdown](feature-specs/07-ats-scoring.md) — Phase 2
- [08 — Resume preview + initial template](feature-specs/08-resume-preview.md) — Phase 2
- [09 — PDF export + R2](feature-specs/09-pdf-export.md) — Phase 3
- [10 — Resume dashboard](feature-specs/10-resume-dashboard.md) — Phase 3
- [11 — JD history](feature-specs/11-jd-history.md) — Phase 3
- [12 — Profile editor](feature-specs/12-profile-editor.md) — Phase 3
- [13 — Workspace management](feature-specs/13-workspace-management.md) — Phase 4
- [14 — RBAC + privacy](feature-specs/14-rbac-privacy.md) — Phase 4
- [15 — Audit logging](feature-specs/15-audit-logging.md) — Phase 4
- [16 — LinkedIn data import](feature-specs/16-linkedin-import.md) — Phase 5
- [17 — Keyword gap analysis](feature-specs/17-keyword-gap-analysis.md) — Phase 5
- [18 — MCP integration](feature-specs/18-mcp-integration.md) — Phase 5
- [19 — Existing resume file import](feature-specs/19-resume-file-import.md) — proposed Phase 6
- [20 — Template customization](feature-specs/20-template-customization.md) — proposed Phase 6

## Sources and status authority

The [source plan](../docs/source-plan.md) is a working copy of the supplied plan with its folder layout normalized to this standalone project. It contains proposed commands and conflicting feature numbering; current reconciliations are explicit in decisions.md. This context is self-contained.

The live user request authorizes documentation now and defers development until confirmation. Root [AGENTS.md](../AGENTS.md) records that gate. The [root project tracker](../project-tracker.md) links to the single canonical progress file here.

Canonical ownership: frontend-integration.md for reference evidence/component boundaries; resume-editing-contract.md for cross-feature suggestion semantics; decisions.md for accepted/open choices; build-plan.md for feature IDs/phases; feature specs for behavior/acceptance; domain documents for shared contracts; progress-tracker.md for actual progress. Update related documents together when a decision changes.
