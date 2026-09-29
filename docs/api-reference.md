# Planned API Reference

**Contract draft; no endpoints are implemented.** All external paths below are relative to one `/api/v1` prefix. This reconciles conflicting service headings in the source plan. Proposed additions are labeled and need contract review before implementation.

## Shared rules

- Bearer/session authentication resolves the actor server-side. Proposed workspace selector: `X-Workspace-Id`; resolve type and membership from authoritative data. The shell's active workspace is not an authorization grant.
- For shared profile operations, an optional `profileId` query/body selector identifies a target; omission resolves the actor's profile. Resolve the selector under workspace/profile grants. Never treat the ID as sufficient authority.
- Proposed envelopes: `{ data, requestId }`; errors `{ error: { code, message, fieldErrors? }, requestId }`. Lists include a bounded `nextCursor`; use an allowlisted sort plus stable ID tie-breaker, default updated time+ID. Bind cursors to the query, sort and workspace.
- Use 401 for missing/invalid session, 403 for known denied capability, 404 for absent or deliberately concealed out-of-scope objects, 409 for revision/idempotency conflict, 422 for validated field errors, and 429 for rate limits. Do not reveal object existence through inconsistent errors.
- Mutation input cannot set actor, owner, role grants, score, task status, or object keys unless an explicit validated operation owns that field.
- Proposed `Idempotency-Key` for generation/import/export jobs; expected revision for profile/resume writes. A replay with different payload is a conflict.
- Background endpoints return 202 with owned resource/run identifiers and sanitized status; never leak another actor's Trigger.dev token or raw task output.

## Auth service

| Method | Path | Contract |
|---|---|---|
| GET | `/auth/google/url` | Create a bound OAuth transaction; return authorized provider URL |
| POST | `/auth/google/callback` | Validate callback transaction and code; exchange server-side; establish session |
| GET | `/auth/linkedin/url` | Equivalent LinkedIn initiation |
| POST | `/auth/linkedin/callback` | Equivalent LinkedIn callback |
| POST | `/auth/refresh` | Rotate the current application refresh session |
| POST | `/auth/logout` | Revoke the session and clear client credentials |
| GET | `/auth/me` | Minimal identity/session summary; no raw provider data |

Provider redirect lands on the auth MFE callback page, which submits the validated transaction to the callback API. Verify the actual provider configuration and supported scopes during F02. OAuth login does not imply full LinkedIn profile-import access. Session transport/cookies and account linking depend on D08/D10.

## Profile service

| Method | Path | Contract / permission |
|---|---|---|
| GET | `/profile` | Authorized professional DTO; `profile.read`; contact excluded by default |
| PUT | `/profile` | Validate allowlisted professional fields + revision; `profile.update` |
| POST | `/profile/setup` | Validate and complete onboarding; own profile or expressly authorized creation |
| GET / PUT | `/profile/contact` | Separate DTO/write schema; `profile.contact.read` / `profile.contact.update` |
| GET / POST | `/profile/education` | List/create a scoped education row |
| PUT / DELETE | `/profile/education/:id` | Update/delete via authorized parent profile |
| GET / POST | `/profile/experience` | List/create experience |
| PUT / DELETE | `/profile/experience/:id` | Update/delete experience |
| GET / POST | `/profile/skills` | List/create skills |
| PUT / DELETE | `/profile/skills/:id` | Update/delete skills |
| GET / POST | `/profile/projects` | List/create professional projects |
| PUT / DELETE | `/profile/projects/:id` | Update/delete projects |
| GET / POST | `/profile/certifications` | List/create certifications |
| PUT / DELETE | `/profile/certifications/:id` | Update/delete certifications |
| POST | `/profile/import/linkedin` | Phase 5: validate upload reference, create preview; proposed confirm endpoint below |

Section reads require `profile.read`; section writes require `profile.update` on the parent. Dedicated contact permissions cannot be bypassed through `/profile` or import. Proposed additions: `PUT /profile/draft` for partial onboarding save, `DELETE /profile` for an approved profile-deletion lifecycle, `GET /profile/import/:id` for review, and `POST /profile/import/:id/confirm` for explicit merge. D03/D11 govern destructive/shared effects.

## Resume service

| Method | Path | Contract / permission |
|---|---|---|
| POST | `/jd/parse` | profileId + bounded rawJD → saved parsed JD; profile access and `resume.create` in this draft |
| POST | `/resume/generate` | profileId, jdHistoryId, templateId, expected input revisions → resumeId/runId; `resume.generate` + create authority |
| POST | `/resume/token` | Verified runId → short-lived run-scoped subscription token; current resource access |
| GET | `/resumes` | Paginated scoped resume summaries; `resume.read` |
| GET | `/resume/:id` | Sanitized current content/version metadata; `resume.read` |
| PUT | `/resume/:id` | User-edited content + expected revision → new version; `resume.update` |
| DELETE | `/resume/:id` | Remove access and schedule safe artifact cleanup; `resume.delete` |
| GET | `/resume/:id/download` | Version/variant selection resolved server-side → authorized PDF; `resume.download` |
| POST | `/ats/score` | Authorized version + JD → stored five-component score; `ats.run` |
| POST | `/skills/gap-analysis` | Phase 5 authorized profile/version + JD → grounded gaps; `skillgap.analyze` |
| GET | `/templates` | Available registry entries and versions; `template.view` |
| GET | `/jd-history` | Scoped paginated history; `profile.read` + `resume.read` in this draft |

Proposed additions: `GET /resume/:id/versions`, `GET /resume/:id/versions/:versionNumber`, `GET /resume/runs/:runId`, `POST /resume/:id/export`, and `GET /jd-history/:id`. Each uses its parent read/generate/download permission and current scope. Contact-bearing versions/export variants additionally require `profile.contact.read`.

For a “paste JD and generate” UI, first call JD parse or have the generate use case invoke the same parser with rawJD. Define one validated union contract before implementation; do not create divergent parser behavior. F05 owns input validation and F06 owns orchestration.

## Workspace service

| Method | Path | Contract / permission |
|---|---|---|
| GET | `/workspaces` | Actor's personal workspace and current memberships only |
| POST | `/workspaces/switch` | Validate selected membership; return scoped capabilities; no privilege change |
| POST | `/organizations` | Authenticated workspace creation under approved creation limits; creator becomes owner |
| GET | `/organizations/:id` | Sanitized details; `workspace.settings.view` |
| GET | `/organizations/:id/members` | Sanitized members; `workspace.members.view` |
| POST | `/organizations/:id/members` | Invite to allowed role; `user.invite` plus grant constraints |
| PUT | `/organizations/:id/members/:memberId` | Validated role/status change; `workspace.members.manage` / `user.manage` as applicable |
| DELETE | `/organizations/:id/members/:memberId` | Remove membership; `user.remove`; preserve final owner |
| POST | `/vendors` | Create vendor; no automatic access to others' profiles |
| GET | `/vendors/:id/members` | Scoped sanitized list; `workspace.members.view` |
| POST | `/vendors/:id/members` | Invite/assign only after D02 is resolved |

Proposed symmetry additions: `GET /vendors/:id`, `PUT/DELETE /vendors/:id/members/:memberId`, `PUT /workspaces/:id/settings`, `POST /workspace-invitations/:token/accept`, invitation revoke/resend operations, and `GET /workspaces/:id/audit`. Invitation token redemption is identity-bound; audit requires `audit.view`. Detailed creation, delegation, and owner-transfer policy is finalized in F13/F14, not by adding new permission names casually.

## Storage service

| Method | Path | Contract |
|---|---|---|
| POST | `/storage/presign/upload` | Authorize allowed purpose/resource, set type/size/key limits, return short-lived upload capability |
| POST | `/storage/presign/download` | Resolve authorized version/artifact and privacy variant; return bounded capability |
| DELETE | `/storage/object` | Resolve approved resource deletion via domain policy; reject arbitrary bucket/key deletion |

Do not accept a raw R2 key as proof of ownership. Prefer domain download/export APIs for application UI. Storage operations enforce the owning feature's permissions; there is no implicit all-powerful `storage` permission.

## Internal calls

Planned examples: `GET /internal/profile/:id`, `GET /internal/user/:id`, and `POST /internal/upload`. These require service identity and verified actor/resource context and are not gateway routes. Profile responses still apply privacy; privileged internal networking never justifies a raw UserContact dump.

Implementation will add OpenAPI/schema fixtures and contract checks alongside these descriptions. Until then, every route above remains planned.

## Proposed basic-builder and section-suggestion routes (F06/F08)

The complete payload, lifecycle, idempotency and conflict rules are in [editing contract](../context/resume-editing-contract.md). All routes retain the `/api/v1` prefix and current scoped authorization.

| Method | Path | Contract |
|---|---|---|
| POST | `/resumes` | Explicit blank/profile-copy mode with authorized profile association and template; JD optional; resume.create + input/template read access |
| POST | `/resume/:id/suggestions` | Explicit target/base-version/action/instruction → private suggestion/run; resume.read + resume.generate + resume.update |
| GET | `/resume/:id/suggestions/:suggestionId` | Scoped proposal/status/provenance with current parent/input read access |
| POST | `/resume/:id/suggestions/:suggestionId/apply` | Expected revision + idempotency; apply stored validated proposal as one new version; resume.read + resume.update |
| POST | `/resume/:id/suggestions/:suggestionId/discard` | Mark unapplied suggestion discarded; resume.update; late worker completion cannot reactivate it |

Resolve all inputs under workspace/profile policy. Requests cannot set arbitrary patch paths, generated replacement bodies or authority fields. Apply returns 409 for stale base/target/context; retries with matching identity return the existing result. Manual saves remain PUT `/resume/:id`. Scoring requires a JD and exact version; basic drafts return absent score metadata. F19 import routes below are proposals only; no upload endpoint may be enabled before D14 and implementation verification.

## Proposed U06 dashboard, feedback and Phase 6 routes

These add planning contracts only. Resolve ownership, contacts, revisions and idempotency with the same domain use cases, not UI authority.

| Method / route | Input and behavior | Existing permission / boundary |
|---|---|---|
| `GET /resumes` (expanded) | Bounded query, allowlisted sort, cursor/page size; authorized summary fields only | resume.read; F10; search cannot leak inaccessible titles |
| `PATCH /resume/:id/metadata` | Title and expected revision; content unchanged | resume.update; F10 |
| `POST /resume/:id/clone` | Source version and idempotency → new independent same-workspace draft | resume.read + resume.create + input/template access; current contact projection; F10 |
| `GET/PUT /resume-preferences` | Own active resume ID or null; expected preference revision on write | resume.read and own actor/workspace scope; no access grant; F10 |
| `PUT /resume/:id/issues/:issueId/preference` | Dismiss/reopen for actor; does not alter evaluation or score | ats.view + resume.read; issue/version scope; F07 |
| `POST /resume-imports` | Owned private upload reference + target profile/template + idempotency → staged task | F19 resume.create/template.view, profile.read and contact policy below |
| `GET /resume-imports/:id` | Authorized extraction/review DTO | Creator + current target/input authority; contact-safe projection |
| `POST /resume-imports/:id/confirm` | Staging revision, validated corrections and idempotency → new resume/version | Same creation/contact authority; no profile mutation |
| `POST /resume-imports/:id/cancel` | Creator-authorized terminal cancellation and cleanup request | Current import scope; no late publication |
| `PUT /resume/:id` (F20 expansion) | Explicit content or appearance operation with expected revision; validated render settings | resume.update + template.view; no arbitrary patch/CSS |
| `GET /template-presets` | Own and permitted workspace presets | template.view; settings only, no resume content |
| `POST /template-presets` | Create personal or shared validated settings preset | Own personal scope + resume.update; shared scope template.manage |
| `PUT/DELETE /template-presets/:id` | Expected revision update/archive; old version references remain resolvable | Same ownership/manage rules; F20 |

F19 uses existing authorized storage presign with an import-specific purpose and limits; it cannot process arbitrary bucket keys or external URLs. Upload/processing/review of contact-bearing files requires profile.contact.read and profile.contact.update for the target identity. Until server-side separation can be proven, require those permissions for all imports and restrict uncertain results rather than exposing raw text. Confirm stores protected resume-header data only, never writes UserContact. D14 resolves concrete formats/provider/quotas/retention before routes are enabled.
