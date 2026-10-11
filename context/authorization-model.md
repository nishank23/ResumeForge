# Authorization and Privacy Model

## Current audit snapshot — 2026-10-11

Canonical 27 permissions and owned personal checks exist. Contact handlers still use broad profile permissions/profile events; the shared role resolver grants resume editing to common roles unlike the proposed read-only viewer bundle. These are repair blockers. Shared version/PDF/task/MCP privacy remains incomplete.

[Implementation audit](../docs/implementation-audit.md) provides completion checklists, source, gaps and priorities. Dated observations and original target designs below remain historical evidence or future acceptance.

## Enforcement contract

Phase 1's local actor verification is implemented through the server-only [actor resolution boundary](../docs/actor-resolution.md). It verifies the caller service and live user session and returns only user/personal-workspace IDs plus expiry. This identity context grants no action, sharing or contact permission; consumer use cases still perform the remaining checks below. Shared-role proposals remain inactive. The local [professional profile API](../docs/profile-api.md) permits only owned `profile.read`/`profile.update` after scope/resource checks; contact and other actions remain inactive at that boundary.

Authenticate actor → resolve workspace → verify active membership/personal ownership → resolve permitted target profile/resource → check action → project allowed fields → execute authorized use case → durably audit → serialize the allowed response.

Repeat resource/access checks for downloads, resume versions, background jobs, task tokens, internal service reads, and MCP. UI capability flags are only hints. Unknown actions, workspace/role mismatches, suspended memberships, revoked grants, and absent policy mappings deny access.

## Canonical permissions: 27

| Permission | Purpose |
|---|---|
| `profile.read` | View authorized professional data |
| `profile.create` | Create a profile in an allowed ownership model |
| `profile.update` | Edit professional sections |
| `profile.delete` | Delete an authorized profile |
| `profile.contact.read` | View protected contact information |
| `profile.contact.update` | Edit protected contact information |
| `resume.read` | View authorized resumes/versions |
| `resume.create` | Create a resume record |
| `resume.update` | Save a resume revision |
| `resume.delete` | Delete a resume |
| `resume.generate` | Start AI tailoring |
| `resume.download` | Download a permitted PDF variant |
| `ats.run` | Run alignment scoring |
| `ats.view` | View stored scores |
| `skillgap.analyze` | Run Phase 5 gap analysis |
| `coverletter.generate` | Reserved, disabled through proposed Phase 6 |
| `coverletter.read` | Reserved, disabled through proposed Phase 6 |
| `user.invite` | Invite a user into a workspace; not global identity administration |
| `user.manage` | Manage permitted workspace-user state |
| `user.remove` | Remove a workspace member, not their global account |
| `workspace.members.view` | View a sanitized member list |
| `workspace.members.manage` | Change permitted membership/role assignments |
| `workspace.settings.view` | View workspace settings |
| `workspace.settings.manage` | Change allowed workspace settings |
| `template.manage` | Manage workspace templates when that feature exists |
| `template.view` | View available templates |
| `audit.view` | Read authorized audit events |

Cover-letter permissions confer no capability before a separately approved feature. `template.manage` remains reserved until proposed F20 shared appearance presets are implemented and approved; F08 provides a read-only initial registry. Permission definition does not mean the corresponding endpoint exists.

## Proposed complete role mapping (D05)

The source supplies examples, not a complete mapping. The following explicit bundles fill gaps for review. They preserve all example grants/denials in the source. Manager scope and vendor administrator contact rights remain open; do not activate this draft in production without resolving D05.

| Bundle | Exact permissions |
|---|---|
| Read | profile.read, resume.read, resume.download, ats.view, template.view |
| Edit | All Read; profile.create, profile.update, resume.create, resume.update, resume.generate, ats.run, skillgap.analyze |
| Delete | profile.delete, resume.delete |
| Contact | profile.contact.read, profile.contact.update |
| Members-read | workspace.members.view |
| Admin | user.invite, user.manage, user.remove, workspace.members.view, workspace.members.manage, workspace.settings.view, workspace.settings.manage, audit.view |
| Templates-admin | template.manage (inactive until custom templates are separately implemented) |

| Role | Proposed bundles | Mandatory scope |
|---|---|---|
| USER | Edit + Delete + Contact | Own personal workspace and own profile/resumes only |
| ORG_OWNER | Edit + Delete + Contact + Admin + Templates-admin | Organization-scoped authorized resources; preserve a final active owner |
| ORG_ADMIN | Edit + Delete + Contact + Admin + Templates-admin | Same resource scope; cannot grant owner/alter protected owners |
| ORG_MANAGER | Edit + Members-read | Authorized workspace profiles; no contact or role management by default |
| ORG_EDITOR | Edit | Authorized workspace profiles; no contact |
| ORG_VIEWER | Read | Authorized workspace profiles; no contact |
| VENDOR_OWNER | Edit + Delete + Admin + Templates-admin | Vendor-scoped authorized resources; no contact in this draft |
| VENDOR_ADMIN | Edit + Delete + Admin + Templates-admin | Vendor scope; cannot grant owner/alter protected owners; no contact |
| VENDOR_MANAGER | Edit + Members-read | Vendor scope; no contact or role management |
| VENDOR_EDITOR | Edit | Vendor scope; no contact |
| VENDOR_VIEWER | Read | Vendor scope; no contact |

All permissions remain subject to profile grants/ownership, feature availability, and more restrictive field policy. No role grants global access. An owner-transfer flow is a separate protected operation with an explicit policy, not a side effect of arbitrary role updates. `user.manage` never bypasses `workspace.members.manage` for a role change.

## Field classes

| Data | Draft policy |
|---|---|
| Full name, professional summary, education, experience, skills, projects, certifications | Available only through authorized profile/resume access |
| Email, phone, address, LinkedIn/GitHub/portfolio URLs in UserContact | Treat the full UserContact record as protected until a field-specific policy is approved |
| Login email, provider payload, refresh credentials | Auth-service private; never returned by a workspace profile/member list |
| City/region in UserProfile.location | Professional location only; never silently copy full street address here |
| Protected contact copied into free text | Prevent insertion into generated professional content; validate/sanitize known contact values and restrict artifacts when safe projection is uncertain |
| Resume/PDF headers | Authorize separately; choose contact-bearing or contact-free variant under D12 |
| Audit/task metadata, errors, telemetry | Identifiers/status only as needed; no sensitive values or tokens |

Contact policy applies regardless of where a value is stored. Field separation alone cannot prevent leakage through imported free text, an earlier full PDF, or cached responses. Never return full content and rely on CSS to hide it.

## Personal and shared workspace checks

Personal requests bind the authenticated user to their one personal workspace. Shared requests require active membership plus profile/resource authorization under D03. A user changing the workspace header does not move or copy data. Record workspace scope at creation; do not infer it from the currently selected UI later.

Membership revocation invalidates future reads, mutations, and task-token issuance. Workers recheck access before fetching private input and before publishing output. Signed URLs are scoped, short-lived capabilities; choose expiry/revocation behavior in D10/D12, and do not claim an already-issued URL is instantly revocable without an implemented mechanism.

## Audit and verification

Audit profile/contact reads, updates, generation, downloads, deletion, invitations, removals, role changes, and denied sensitive actions with allowlisted metadata. Permission names are capability keys; event names such as `contact.viewed` are historical facts, not interchangeable constants.

Exercise every role against every permission and workspace type, plus cross-tenant and cross-profile ID substitution. Verify restricted data is absent from REST, task metadata, cached DTOs, all historical resume versions, PDF text/metadata, and MCP. See [F14](feature-specs/14-rbac-privacy.md) and [F15](feature-specs/15-audit-logging.md).

## Contextual prompt authorization

The [editing contract](resume-editing-contract.md) reuses existing permissions; the catalog stays at 27. Creating a suggestion requires resume.read, resume.generate, resume.update and authorized input access. Reading a proposal rechecks its parent and inputs; Apply requires resume.read/resume.update and current resource/input access. Basic creation requires resume.create plus profile/template read authority. No action gains profile.update or contact rights by being inside a prompt.

Contact/header targets are excluded from AI assistance. Authorize and sanitize instruction input, source facts, proposal text, reasons, diffs, run handles and all resulting versions. Revoke or clear pending selections/suggestions on access or workspace changes; never apply a late result to a new scope. Server policy, not disabled controls or hidden toolbar buttons, enforces these rules.

## U06 capability policy extensions (proposed)

F10 cloning requires source resume.read plus resume.create, input/template authority and current contact projection; source scope and target workspace must match. Active resume is an actor/workspace preference under resume.read, not a new role or sharing grant. Issue dismissal changes only that actor's view preference under ats.view/resume.read; it cannot change stored scores.

F19 uses resume.create, template.view, profile.read and, conservatively for all file intake until safe separation is proven, profile.contact.read/profile.contact.update for the target. Workers and confirmation repeat these checks. Extracted contacts remain protected resume-header staging/snapshots; UserContact and the master profile are never automatically written. Reject/restrict ambiguous free text rather than leaking it to a restricted reader.

F20 selection/formatting uses resume.update plus template.view. Own personal presets use own-scope resume.update; shared preset publication/update/archive uses template.manage and approved D05 grants. Template management permits validated appearance settings only, never arbitrary executable content or broader profile access. Cover-letter permissions stay inactive through proposed Phase 6. Catalog remains exactly 27 identifiers; MCP remains seven tools.
