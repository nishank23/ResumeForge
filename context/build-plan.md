# Master Build Plan

**Planning baseline updated:** 2026-09-29. **Current stage:** Context prepared for review. **Development:** Not started; user confirmation required.

The feature numbering follows section 12 of the supplied plan. The source folder list's conflicting names are reconciled in [decisions.md](decisions.md). Feature numbers are stable identifiers, not mandatory execution order.

## Roadmap

| Phase | Build plan | Features | Exit outcome |
|---|---|---|---|
| 0 | [Context review](build-plans/00-context-review.md) | Documentation only | User confirms context and authorizes development |
| 1 | [Foundation](build-plans/01-foundation.md) | 01–04 | Sign-in and saved personal profile |
| 2 | [AI pipeline](build-plans/02-ai-pipeline.md) | 05–08 | Basic builder, JD tailoring, score, preview and contextual section suggestions |
| 3 | [Complete individual flow](build-plans/03-individual-flow.md) | 09–12 | Saved-work management and PDF export |
| 4 | [Multi-tenant](build-plans/04-multi-tenant.md) | 13–15 | Consented, isolated organization/vendor access |
| 5 | [Advanced](build-plans/05-advanced.md) | 16–18 | Reviewed LinkedIn import, gaps, and MCP reuse |
| 6 (proposed) | [Resume builder expansion](build-plans/06-builder-expansion.md) | 19–20 | Reviewed resume-file intake and template/format customization |

## Canonical feature register

| ID | Phase | Specification | Priority | Dependencies / decision gates |
|---|---|---|---|---|
| F01 | 1 | [Design system](feature-specs/01-design-system.md) | Critical | D06/D13; Performative UI wrappers; toolchain/federation check |
| F02 | 1 | [Google + LinkedIn OAuth](feature-specs/02-auth-oauth.md) | Critical | F03 identity foundation; F01; D08/D10 |
| F03 | 1 | [Database schema + Prisma](feature-specs/03-database-schema.md) | Critical | D03/D04/D07/D08/D11 as applicable |
| F04 | 1 | [Individual profile wizard](feature-specs/04-profile-wizard.md) | Critical | F01/F02/F03 |
| F05 | 2 | [JD parser](feature-specs/05-jd-parser.md) | Critical | Phase 1; provider/task contracts |
| F06 | 2 | [Resume generator + suggestions](feature-specs/06-resume-generator.md) | Critical | F05; task lifecycle; D12 |
| F07 | 2 | [ATS scoring + breakdown](feature-specs/07-ats-scoring.md) | Critical | F05/F06; D07/D09 |
| F08 | 2 | [Resume builder + preview](feature-specs/08-resume-preview.md) | Critical | F01/F06; F07 integration; D12 |
| F09 | 3 | [PDF export + R2](feature-specs/09-pdf-export.md) | High | F06/F08; D10/D12 |
| F10 | 3 | [Resume dashboard](feature-specs/10-resume-dashboard.md) | High | F06/F08/F09 |
| F11 | 3 | [JD history](feature-specs/11-jd-history.md) | High | F05/F06/F10 |
| F12 | 3 | [Profile editor](feature-specs/12-profile-editor.md) | High | F03/F04; revision semantics |
| F13 | 4 | [Workspace management](feature-specs/13-workspace-management.md) | High | Individual flow; D02/D03/D04; F14/F15 release gate |
| F14 | 4 | [RBAC + privacy](feature-specs/14-rbac-privacy.md) | High | F13 contracts; D03/D05/D12 |
| F15 | 4 | [Audit logging](feature-specs/15-audit-logging.md) | Medium | Early capture foundation; F13/F14; D11 |
| F16 | 5 | [LinkedIn data import](feature-specs/16-linkedin-import.md) | Medium | F12/F14/F15; supported archive contract |
| F17 | 5 | [Keyword gap analysis](feature-specs/17-keyword-gap-analysis.md) | Medium | F05/F07/F14/F15; D07 |
| F18 | 5 | [MCP integration](feature-specs/18-mcp-integration.md) | Medium | Stable APIs; F14/F15/F17; transport/auth review |
| F19 | 6 proposed | [Existing resume file import](feature-specs/19-resume-file-import.md) | High | F08/F09/F10/F14/F15; D14 |
| F20 | 6 proposed | [Template customization](feature-specs/20-template-customization.md) | High | F08/F09/F10/F14/F15; template inventory and render limits |

## Dependency order

1. Context review and explicit development authorization.
2. Phase 1 compatibility/scaffold. F01 UI can progress alongside approved F03 persistence contracts; F03's identity/session foundation precedes persisted F02 authentication, then F04 onboarding.
3. Phase 2 task/provider foundation → F05 parser → F06 basic creation/grounded generation and suggestion service → F07 scoring and F08 contextual editor/review/apply integration.
4. Phase 3 F09 export → F10 dashboard → F11 history, with F12 profile editing built against the established revision contract.
5. Phase 4 F13 membership contracts, F14 role/privacy implementation, and F15 durable audit complete as one release gate. Personal ownership and audit capture already exist from Phase 1.
6. Phase 5 F16 import and F17 gap analysis, then F18 MCP over verified domain APIs.
7. Proposed Phase 6 F19 file intake and F20 template/settings expansion, after the shared rendering and policy gates. These can proceed independently once their own decisions are resolved.

No phase may be labeled complete while a required integration gate is missing. Work on independent authorized slices can proceed when an unrelated decision is open; do not cross that decision's affected boundary.

## Build-plan conventions

Each phase plan identifies intended file areas, unchecked implementation tasks, meaningful verification, and its exit gate. Those paths are proposed future files until implemented. Check a task only after completing it and record the evidence in [progress-tracker.md](progress-tracker.md).

Use [validation-strategy.md](validation-strategy.md) for cross-cutting tests. Establish exact package/CLI commands during scaffolding against the approved pnpm, Vite, and Hono toolchain.

## Scope and release boundaries

Phases 1–2 are the MVP core in the source plan; Phase 3 completes the individual release flow. Phase 4 is the first shared-workspace release. Phase 5 makes advanced features and MCP available.

One initial template and its registry belong to F08. U06 adds proposed Phase 6: F19 existing-file import and F20 original template gallery, formatting and validated appearance presets. Arbitrary template-code authoring, cover letters and billing remain unallocated; D01 governs future billing. Recruitment workflows never belong to this product.

No dates, staffing estimates, sprint commitments, or production-readiness claims were supplied. Sequence by dependencies and evidence instead of inventing a delivery schedule.

## Requested capability integration — 2026-09-29

The same-day follow-up expands F01 compositions to suitable Performative UI backgrounds, surfaces and accents alongside shadcn/ui (U05). It resolves reference-editor access through an authorized Chrome inspection; that earlier follow-up did not introduce an additional phase or authorize implementation. The later U06 allocation below supersedes its phase limit.

[Performative UI integration](frontend-integration.md) adds F01 dependency/style/accessibility checks and shared prompt wrappers. [Contextual editing](resume-editing-contract.md) expands F06/F08 in Phase 2, F07 freshness/action links, and F09–F12 management/export continuity in Phase 3. Phase 4 verifies suggestion privacy/audit; F17 can open a supported suggestion in Phase 5. Original F01–F18 IDs and allocations remain intact. U06 adds F19/F20 in proposed Phase 6, expanding the plan to 20 features; see [capability coverage](resume-capability-coverage.md). D14 gates the proposed F19 import details. Phase 2/3 also expand editor, issue and dashboard acceptance; no unchanged effort estimate is implied. Visual concepts are paused and development has not begun.
