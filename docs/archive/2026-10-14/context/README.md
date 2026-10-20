> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Context index

## Status authority — 2026-10-11

The personal app is implemented in bounded slices. [Implementation audit](../docs/implementation-audit.md) is the current source-linked status snapshot; [build plan](build-plan.md) is the feature/phase register; [progress tracker](progress-tracker.md) retains dated verification. Context approval was cleared on 2026-09-29. Later user decisions authorize the implemented resume-first flow, paid Gemini, private vector retrieval, file review, templates and UI work.

Plans describe both existing and future scope. Their audit headers supersede old “not started” statements. A historical handoff or test count does not prove current runtime activation or fresh verification.

## Reading order

1. [Project overview](project-overview.md).
2. [Architecture](architecture-context.md).
3. [UI context](ui-context.md).
4. [Code standards](../../../../context/code-standards.md).
5. [Workflow rules](ai-workflow-rules.md).
6. [Progress tracker](progress-tracker.md).
7. [Decisions](decisions.md).
8. [Master build plan and all 20 feature specs](build-plan.md).

## Domain contracts

- [Data model](../../../../context/data-model.md) and [authorization model](../../../../context/authorization-model.md).
- [Editing contract](resume-editing-contract.md) and [capability coverage](resume-capability-coverage.md).
- [Frontend integration](frontend-integration.md) and [validation strategy](../../../../context/validation-strategy.md).
- [Phase 1 decision review](phase-1-decision-review.md), retained with current-status corrections.
- [Error/fix history](error-and-fix-log.md).

## Runtime and integration

- [Product setup](../../../../README.md) and [full local Docker setup/verification](../../../docker-setup.md).
- [Current API boundaries](../../../api-reference.md) and [frontend readiness](../../../frontend-api-readiness.md).
- [Google sign-in](../../../google-login.md), [actor resolution](../../../actor-resolution.md), [profile API](../../../profile-api.md).
- [Runtime database roles](../../../runtime-database-roles.md), [ATS/AI workflow](../../../ats-workflow.md), [private vector search](../../../resume-vector-search.md).
- [Task ownership](../../../../context/development-status.md), [scheduled workflow](../docs/scheduled-development.md), [branch ownership](../docs/parallel-development.md).
- [Development prompts](../docs/development-prompts.md), [editor plan](../docs/frontend-editor-plan.md).
- [Planned deployment](../../../deployment.md) and [unbuilt MCP contract](../../../mcp-integration.md).

## Phase plans

[0 Context review](build-plans/00-context-review.md) · [1 Foundation](build-plans/01-foundation.md) · [2 AI pipeline](build-plans/02-ai-pipeline.md) · [3 Individual](build-plans/03-individual-flow.md) · [4 Shared](build-plans/04-multi-tenant.md) · [5 Advanced](build-plans/05-advanced.md) · [6 Builder expansion](build-plans/06-builder-expansion.md).

## Historical material

The [source plan](../docs/source-plan.md), dated backend handoffs/reference inspections and [archived README history](../../readme-history.md) preserve original requirements/evidence. They cannot override current code, permissions, provider selections or active branch. The [root tracker](../project-tracker.md) points to this canonical tracker.
