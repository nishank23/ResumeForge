# Project Overview

## Current audit snapshot — 2026-10-11

The local personal app provides Google sign-in, resume-first library, blank creation/modal upload review, immutable saves, readiness/JD evidence, paid Gemini scoped rewriting, three styles and saved owner PDFs. Basic master-profile editing is optional. Shared workspaces are not connected; LinkedIn archive import and MCP are not built.

[Implementation audit](../docs/implementation-audit.md) provides completion checklists, source, gaps and priorities. Dated observations and original target designs below remain historical evidence or future acceptance.

## Purpose

resume-forge is a multi-tenant AI resume and professional-profile management platform. Individuals maintain a master profile and generate JD-tailored resumes. Organizations and vendors help authorized workspace members manage profiles and resumes under role-based permissions and field-level privacy.

The platform uses microservices and microfrontends, with reusable REST and MCP interfaces for possible future integrations. This does not expand the product into recruitment software.

**Status:** Local personal app implemented; wider roadmap partially complete. A working copy of the supplied plan, with its folder layout normalized to this project, is in [source-plan.md](../docs/source-plan.md). Confirmed decisions and draft elaborations are separated in [decisions.md](decisions.md).

## Users and workspaces

| Workspace | Purpose | Roles |
|---|---|---|
| Individual | Manage one's own profile, JDs, and resume versions | `USER` |
| Organization | Shared resume support, such as a consultancy or university | `ORG_OWNER`, `ORG_ADMIN`, `ORG_MANAGER`, `ORG_EDITOR`, `ORG_VIEWER` |
| Vendor | Controlled profile and resume services with contact restrictions | `VENDOR_OWNER`, `VENDOR_ADMIN`, `VENDOR_MANAGER`, `VENDOR_EDITOR`, `VENDOR_VIEWER` |

Every user has one personal workspace and can also hold memberships in multiple organizations/vendors. The active workspace scopes navigation, permissions, resources, server responses, and cached data. A workspace membership alone does not establish permission to another person's private master profile; the sharing policy remains open.

## Main individual journey

1. Sign in using Google; LinkedIn is disabled.
2. Enter My resumes directly; optional master-profile editing is separate.
3. Review the master profile, which remains the source of truth.
4. Choose a basic draft from profile facts or supply a JD for tailoring; use the initial resume template.
5. For tailoring, parse the JD and generate supported content asynchronously; a basic draft does not require AI or JD scoring.
6. Inspect the preview, available ATS heuristic evidence, and version status.
7. Select a resume section/item, use contextual prompts or manual edits, review proposed changes, save a new version and export its PDF.
8. Revisit saved resumes, versions, and JD history; explicitly edit the master profile when facts change.

Phase 4 adds workspace switching and authorized collaboration. Phase 5 adds reviewed LinkedIn archive import, keyword gap analysis, and MCP reuse.

## Scope

In scope: profiles and separate contacts; OAuth sessions; resume generation and versioning; JD parsing/history; a five-component ATS score; PDF preview/export; an initial template; organization/vendor membership management; RBAC/privacy; audit events; later data import, gap analysis, and MCP.

Out of scope through Phase 5: cover letters, additional template packs, billing implementation, native mobile apps, real-time collaborative editing, and recruitment workflows. No jobs database, candidates, applicant tracking, interview scheduling, offers, or hiring pipelines. ATS scoring here evaluates resume alignment and readability; it is not an applicant tracking system or a guarantee of a hiring outcome.

Billing's long-term scope remains undecided. Additional templates and cover letters are backlog items, not hidden requirements of an earlier phase.

## Delivery phases

| Phase | Features | User-visible milestone |
|---|---|---|
| 1 — Foundation | 01 design system; 02 OAuth; 03 database; 04 profile wizard | A user signs in and saves a private master profile |
| 2 — AI pipeline | 05 JD parser; 06 generation and suggestions; 07 ATS; 08 builder/preview and initial template | A user builds or tailors a resume and reviews section-specific edits |
| 3 — Complete individual flow | 09 PDF export; 10 dashboard; 11 JD history; 12 profile editor | A user manages, revises, and downloads saved work |
| 4 — Multi-tenant | 13 workspace management; 14 RBAC/privacy; 15 audit logging | Organizations/vendors operate with verified isolation and privacy |
| 5 — Advanced | 16 LinkedIn import; 17 keyword gap analysis; 18 MCP | Users import data and reuse the same secured engine through integrations |

Phases 1–2 form the MVP core described in the source. Phase 3 is the complete individual release milestone. Shared-workspace capabilities must not be exposed before Phase 4's authorization, privacy, and audit gates pass.

## Success criteria

- The individual flow works from sign-in to a persisted, downloadable resume version.
- Generated claims can be traced to permitted profile facts or explicitly confirmed resume-local facts with provenance; generation never writes to the master profile.
- A user cannot read another user's individual workspace or another workspace's resources by changing IDs.
- Vendor editors/viewers cannot obtain private contact fields through any response or artifact.
- Retry, failed generation, expired sessions, and missing artifacts have understandable recovery paths.
- REST and MCP enforce equivalent policy. The engine remains usable without importing workspace/authentication code.
- Documentation and tracker states match evidence from the implementation when it exists.

See [build-plan.md](build-plan.md) for execution order and [validation-strategy.md](validation-strategy.md) for release evidence.

## Frontend and resume capability update

The user selected Performative UI and section-context prompts; [frontend integration](frontend-integration.md) maps the frontend request to the baseline features; [capability coverage](resume-capability-coverage.md) adds the later comprehensive mapping. CareerZenith informs resume capabilities only; the product retains its own design and terminology. The basic JD-optional builder and review/apply interaction are proposed details in [editing contract](resume-editing-contract.md). File intake is now F19 under D14, separate from F16; F20 adds templates/format controls. Both are proposed Phase 6 additions. Forge Studio is implemented; wider scope remains in the feature register.

## Comprehensive builder scope — U06

The plan now has 20 features across five baseline phases and a proposed sixth: [F19 existing-file import](feature-specs/19-resume-file-import.md) and [F20 templates/formatting](feature-specs/20-template-customization.md). Phase 2 includes blank/profile drafts, structured section edits and actionable feedback; Phase 3 includes search/sort, rename, clone, active-resume preference and JD/version history. See the [coverage register](resume-capability-coverage.md). Cover letters and billing stay unallocated; this amendment adds planning scope only.
