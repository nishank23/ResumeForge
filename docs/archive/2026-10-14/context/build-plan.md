> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Master build plan

## Current status — 2026-10-11

Context review and subsequent personal slices were authorized. The personal resume app is implemented; broad phase exit gates are incomplete. Feature IDs remain stable. The [implementation audit](../docs/implementation-audit.md) compares every documentation file with source and explains missing work.

## Feature register

| ID | Feature | Status | Source evidence |
| --- | --- | --- | --- |
| F01 | [Design system](feature-specs/01-design-system.md) | ✅ Done for foundation scope | [Module](../../../../packages/shared/src/index.ts) |
| F02 | [OAuth and sessions](feature-specs/02-auth-oauth.md) | Partially done | [Module](../../../../services/auth-service/src/app.ts) |
| F03 | [Database and persistence](feature-specs/03-database-schema.md) | Partially done | [Module](../../../../packages/prisma-client/prisma/schema.prisma) |
| F04 | [Individual profile entry](feature-specs/04-profile-wizard.md) | Partially done; entry scope changed | [Module](../../../../services/profile-service/src/profile.ts) |
| F05 | [JD parser](feature-specs/05-jd-parser.md) | Partially done | [Module](../../../../services/resume-service/src/jd-parser.ts) |
| F06 | [Generation and scoped suggestions](feature-specs/06-resume-generator.md) | Partially done | [Module](../../../../services/resume-service/src/ats/use-cases.ts) |
| F07 | [Readiness and JD scoring](feature-specs/07-ats-scoring.md) | Partially done | [Module](../../../../packages/resume-core/src/jd-scoring.ts) |
| F08 | [Resume builder and preview](feature-specs/08-resume-preview.md) | Partially done | [Module](../../../../apps/resume-mfe/src/ManualResumeEditor.tsx) |
| F09 | [PDF and storage](feature-specs/09-pdf-export.md) | Partially done | [Module](../../../../services/resume-service/src/pdf.ts) |
| F10 | [Resume dashboard](feature-specs/10-resume-dashboard.md) | Partially done | [Module](../../../../apps/resume-mfe/src/ResumeLibrary.tsx) |
| F11 | [JD and optimization history](feature-specs/11-jd-history.md) | Partially done | [Module](../../../../services/resume-service/src/resume.ts) |
| F12 | [Master profile editor](feature-specs/12-profile-editor.md) | Partially done | [Module](../../../../apps/profile-mfe/src/ProfileRemoteRoot.tsx) |
| F13 | [Organization/vendor workspaces](feature-specs/13-workspace-management.md) | Partially done; backend only | [Module](../../../../services/workspace-service/src/workspace.ts) |
| F14 | [RBAC and privacy](feature-specs/14-rbac-privacy.md) | Partially done; shared activation blocked | [Module](../../../../packages/access-policy/src/index.ts) |
| F15 | [Audit logging/viewer](feature-specs/15-audit-logging.md) | Partially done | [Module](../../../../packages/prisma-client/src/audit-delivery.ts) |
| F16 | [LinkedIn archive import](feature-specs/16-linkedin-import.md) | Not started | [Module](feature-specs/16-linkedin-import.md) |
| F17 | [Gap analysis](feature-specs/17-keyword-gap-analysis.md) | Partially done; backend and active JD evidence | [Module](../../../../services/resume-service/src/gap-analyzer.ts) |
| F18 | [MCP integration](feature-specs/18-mcp-integration.md) | Not started | [Module](../../../mcp-integration.md) |
| F19 | [File import](feature-specs/19-resume-file-import.md) | Partially done | [Module](../../../../services/resume-service/src/upload.ts) |
| F20 | [Templates and formatting](feature-specs/20-template-customization.md) | Partially done | [Module](../../../../apps/resume-mfe/src/templates/registry.ts) |

✅ means the stated bounded scope is implemented. Each spec has completed-capability checkmarks and a missing-scope paragraph; full-feature acceptance lists retain unchecked release requirements.

## Phase status

| Phase | Plan | Current outcome |
| --- | --- | --- |
| 0 | [Context review](build-plans/00-context-review.md) | ✅ Authorization cleared; later slice decisions supersede earlier review notes. |
| 1 | [Foundation](build-plans/01-foundation.md) | Partial: federation/theme, database, personal Google identity/policy/audit and optional profile foundation work. LinkedIn and complete profile UI remain. |
| 2 | [AI pipeline](build-plans/02-ai-pipeline.md) | Partial: saved builder, local parsing/scoring, paid Gemini evidence/rewrites and private retrieval. Full grounded generation and durable jobs remain. |
| 3 | [Individual flow](build-plans/03-individual-flow.md) | Partial: library and current-version PDF. Stored history/restore, clone/global queries, JD history and full profile UI remain. |
| 4 | [Multi-tenant](build-plans/04-multi-tenant.md) | Backend source only; shared role/contact/consent/runtime defects and UI/gateway integration block release. |
| 5 | [Advanced](build-plans/05-advanced.md) | Partial gap-analysis source. LinkedIn archive import and MCP are not started. |
| 6 | [Builder expansion](build-plans/06-builder-expansion.md) | Partial local import/review and three saved template styles; broader intake/render/storage/preset scope remains. |

## Dependencies now

Manual editing/import do not require a JD, AI or completed master profile. Local readiness/JD scores do not require a provider; optional analysis and scoped rewriting require billed Gemini configuration. Current PDF streaming does not require R2.

Keep personal route allowlists until proposed capabilities meet their own authorization, validation, privacy and audit contracts. A migrated table, legacy handler or backend handoff does not complete its feature.

Before extending shared access or enabling legacy generation, repair contact permission/events, fabricated metrics/client-supplied proposal application, workspace startup and viewer grants. Then prioritize intake/scoring/PDF quality, durable jobs/provenance and optional profile forms. Saved history/restore, clone/default selection and global library queries were removed from the next-build list at the user’s request on 2026-10-11; their missing-status records remain accurate. Full priorities: [audit](../docs/implementation-audit.md#prioritized-next-work).

## Scope constraints

Preserve Individual, Organization and Vendor models, the 27 permission names, separate UserContact and UserProfile, resume-local versus master-profile writes, immutable versions and explicit grounded review/Apply. Cover-letter, recruitment, hiring and billing workflows remain excluded. Production infrastructure is a separate release requirement; no phase is complete solely because its spec exists.
