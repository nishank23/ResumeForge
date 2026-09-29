# Decisions and Open Questions

Last updated: 2026-09-29. **Prepared for review. Specific user requirements are recorded below; overall context approval and development authorization remain pending.**

See [Phase 1 decision review](phase-1-decision-review.md) for plain-language recommendations and the exact stage at which each choice is needed. The user selected Performative UI and contextual resume prompts on 2026-09-29 and paused visual concept work. Theme/layout and unrelated foundation recommendations remain open. See [frontend integration](frontend-integration.md) and [contextual editing](resume-editing-contract.md).

## How to read status

- **Source-confirmed:** explicitly selected in the supplied plan; preserve unless the user changes it.
- **Reconciled for this draft:** resolves a documentation inconsistency; included for review.
- **Proposed:** a concrete elaboration for review, not an accepted product decision.
- **Open:** needs an answer before the listed dependent implementation begins.

The live user request governs what may be done now: context only, then user confirmation before development. Imperative steps in the source plan describe future work.

## Source-confirmed baseline

| ID | Decision |
|---|---|
| C01 | Resume/profile management only; no recruitment workflows |
| C02 | Turborepo + pnpm; microservices + microfrontends |
| C03 | Vite 6, React 19, TypeScript, Module Federation plugin, React Router v7 |
| C04 | Tailwind v4 + shadcn/ui, React Hook Form + Zod, Zustand + TanStack Query, Tiptap, Lucide, React PDF |
| C05 | Hono services in Node.js containers; Workers portability is a design aim, not the current runtime |
| C06 | Neon PostgreSQL + pgvector + Prisma 7; JSONB stores structured resume content |
| C07 | Google and LinkedIn OAuth with application JWT sessions; no Clerk |
| C08 | Trigger.dev v4; Vercel AI SDK with pluggable providers and Gemini default |
| C09 | Cloudflare Pages for frontends; private Cloudflare R2 for object artifacts |
| C10 | Individual, Organization, Vendor; separate contact data; backend RBAC and audit |
| C11 | Workspace/auth-independent resume engine; AI never modifies the master profile |
| C12 | Original baseline: five phases and 18 features; cover letters and additional templates after Phase 5. U06 adds proposed F19/F20/Phase 6; original IDs stay stable. |

These are requested technology baselines, not assertions that any package combination has been installed or verified.

## User-requested additions — 2026-09-29

| ID | Confirmed direction | Boundary |
|---|---|---|
| U01 | Add Performative UI to the frontend plan, including prompt-based interactions | Complements Tailwind/shadcn/ui; D13 verifies the package and integration before installation |
| U02 | Select a resume section/item and request an update through contextual prompts | F06/F08 expand to reviewed suggestions and scoped version saves; detailed contract is proposed |
| U03 | Use CareerZenith as a resume-building/tailoring capability reference, with our own product design | No copy of branding, page text, private code, job board, community or hiring verdicts |
| U04 | Set visual concepts aside for now; update plans and Markdown documents | No chosen Studio/Focus layout; no development authorization |
| U05 | Use Performative UI backgrounds and other suitable components alongside shadcn/ui; inspect CareerZenith through the user's signed-in Chrome session | Background/surface/ accent direction confirmed; specific component placement remains proposed under D06/D13; editor findings recorded without copying personal resume data |
| U06 | Include the identified CareerZenith resume-builder capabilities comprehensively in our plan | [Coverage register](resume-capability-coverage.md); F08/F07/F10/F11 expanded; F19/F20 and Phase 6 allocation proposed, development still unauthorized |
| U07 | Name the project and planned GitHub repository `resume-forge`; add `.gitignore` while retaining project Markdown for GitHub | Documentation and repository hygiene only; local checkout remains in place; no GitHub publication or development authorized |

Proposed allocation: F01 wrappers/compatibility; F06/F08 basic draft creation and contextual assistance in Phase 2; F09–F12 saved-work integration in Phase 3; F13–F18 reuse the same privacy and scope boundaries. A JD-optional basic builder is a proposed realization of the requested resume-builder capability, not a claim about the inspected competitor editor. U06 now explicitly captures file intake in F19 and template/format customization in F20, both proposed Phase 6. D14 still resolves formats and processing details; this is additional scope, not an implementation claim.

## Reconciliations in this context draft

| ID | Source ambiguity | Draft treatment |
|---|---|---|
| R01 | Establish the standalone repository root | Use repository-relative paths; `resume-forge/` is the canonical repository name, independent of the existing local checkout directory |
| R02 | Feature filenames and phase table use conflicting IDs | Use section 12's phase table as canonical; mapping below |
| R03 | Phase 4 introduces RBAC, but Phase 1 already handles private user data | Implement personal ownership/isolation and audit capture foundations early; extend roles and audit UI in Phase 4 |
| R04 | API section headings conflict with individual route paths | Use a single `/api/v1` prefix followed by the listed paths; proposed supplemental routes are labeled |
| R05 | UserContact relationship diagram points to User but fields use profileId | Contact belongs to UserProfile through a unique profileId; auth identity is separately owned by auth service |
| R06 | `resume-core` diagram includes generation/rendering absent from its sample file tree | Include the domain generation/render contracts; services own I/O, task, persistence, and storage adapters |
| R07 | Schema omits workspace identity, session lifecycle, template/version metadata, and audit durability details | Document proposed additions and blockers in the data model; do not execute the source schema verbatim |
| R08 | Source says post-MVP and also post-Phase 5 for cover letters | Use the more explicit post-Phase 5 boundary; reserve permissions only |

## Feature numbering mapping

| Source folder listing | Canonical feature in this draft |
|---|---|
| 01 design system / 02 auth | 01 design system / 02 auth |
| 03 profile wizard | 04 profile wizard |
| 04 database schema | 03 database schema |
| 05–12 parser through profile editor | Same feature numbers |
| 13 template library | Initial template/registry in 08; expanded library/settings now F20 in proposed Phase 6 |
| 14 LinkedIn import | 16 LinkedIn import |
| 15 keyword gap analysis | 17 keyword gap analysis |
| 16 MCP integration | 18 MCP integration |
| 17 workspace management | 13 workspace management |
| No standalone RBAC file in source folder list | 14 RBAC and privacy |
| 18 audit logging | 15 audit logging |

## Open decisions

| ID | Question and concrete proposal | Needed before | State |
|---|---|---|---|
| D01 | Billing: future seat-based billing or indefinitely out of scope? Proposal: no billing in Phases 1–5; leave future choice open. | Billing scope expansion | Open; not a foundation blocker |
| D02 | Vendor access: accepted invitation or admin assignment? Proposal: explicit invitation acceptance before access, with revocation recorded. Invitation delivery channel also needs choosing. | F13 vendor onboarding and consent | Open |
| D03 | Master profile: cross-workspace shared profile or separate copies? Proposal: user-owned master with explicit workspace grants and revocation; never imply consent from membership. | F03 final profile relations; F13 profile access | Open; schema blocker |
| D04 | Workspace identity: generic Workspace parent with typed org/vendor records, or separate tables and typed references? Proposal: Workspace parent to make tenant foreign keys enforceable and represent the personal workspace explicitly. | F03 initial tenant migration | Open; schema blocker |
| D05 | Complete role grants, manager scope, and vendor owner/admin contact access? Proposal in authorization-model.md denies vendor contact access for every vendor role until policy is agreed. | F14 role activation; affects F13 designs | Open |
| D06 | Modern frontend and useful animations; Performative UI prompts, backgrounds and suitable components selected under U01/U05 alongside shadcn/ui. Final layout, palette, component placement and theme scope remain undecided. Visual concept comparison is paused. | F01 final design tokens | Open; no Studio/Focus selection required now |
| D07 | Embedding provider/model and dimensions? Source requests 1536 for profiles/JDs and 384 for skills. Verify provider output compatibility, index strategy, model versioning, and re-embedding cost before adopting those dimensions. | F03 vector migrations; F07 semantic scoring | Open; do not silently truncate/pad vectors |
| D08 | Identity/session model and account linking? Proposal: unique provider+subject OAuthAccount, hashed rotating refresh sessions, explicit authenticated account linking; no merging solely by email. | F02 schema and OAuth flows | Open |
| D09 | ATS five components and weights? Proposed rubric in F07 totals 100; it is an internal heuristic with a stored rubric version. | F07 scoring implementation | Open |
| D10 | Server container host, environments, domains, notification delivery, region, and retention periods? Cloudflare Pages/R2 do not decide Node.js hosting. | F02 redirect/session configuration; F13 invitations; deployment | Open; local prototyping can use documented development settings |
| D11 | Audit durability, sensitive-read failure policy, and deletion/retention boundaries? Proposal: transactional local outbox, idempotent workspace-service ingestion; no raw content in events. | F03 persistence design; first sensitive routes; F15 reporting | Open |
| D12 | Export contact policy and PDF pipeline? Proposal: contact-free resume bodies, separate protected header snapshots, privacy-specific server PDFs from the same React PDF template used in preview. | F06 content schema; F08 preview; F09 PDF export | Open; never reuse an unrestricted PDF for a restricted reader |
| D13 | Performative UI release and integration: verify registry version, license notices, exported APIs/styles, React 19/Vite 6/federation compatibility, CSS isolation, accessibility and bundle impact. Use shared adapters; no silent stack upgrade. | F01 dependency pinning and component implementation | Library direction confirmed; engineering validation pending |
| D14 | Existing-resume intake is requested under U06 and specified as F19 in proposed Phase 6. Choose accepted formats, parser/processing location, size/page limits, contact handling and retention. Recommendation: text PDF and DOCX first with reviewed extraction; decide legacy DOC and OCR separately. LinkedIn archives stay F16. | Any file-intake implementation or upload promise | Capability included in plan; technical details and Phase 6 allocation open; not a Phase 1 blocker |

## Review outcome to record

When the user responds, record the date, chosen option, affected files, and rationale under the relevant decision. Update all dependent specs and the tracker together. A decision can be explicitly deferred with its implementation boundary recorded; silence does not approve it.

Context review and authorization to develop are separately recorded in [progress-tracker.md](progress-tracker.md). Do not infer either from the existence of these documents.
