# F15 — Audit Logging and Viewer

## Audited status — 2026-10-11

**Partially done.**

- [x] ✅ Content-free validation, atomic capture, persisted outbox claims/backoff/leases, authenticated loopback ingestion, append-only runtime ledger and foreground delivery worker. Workspace audit-list handler exists. [Source](../../packages/prisma-client/src/audit-delivery.ts).

**Remaining:** Connected audit viewer, complete per-action/denial/contact event coverage, shared transport, production identities/supervision, retention/deletion and remediation UI are missing. A query API is not a delivered viewer.

This snapshot supersedes dated implementation/pending statements below. Full acceptance stays unchecked where integration or verification is missing. [Complete audit](../../docs/implementation-audit.md).

**Phase:** 4 — Multi-Tenant · **Priority:** Medium · **Implementation:** Partially done (audited 2026-10-11)

## Goal and dependencies

Make sensitive activity attributable without retaining sensitive payloads in logs. Event/schema/capture foundations start in Phase 1; this phase completes durable cross-service ingestion, tenant audit viewing, and coverage verification. Requires D11 retention/failure policy and F13/F14's scope.

## Ownership and planned files

Workspace service owns AuditEvent ingestion/query APIs and the shell audit viewer. Each service owns capture of its domain actions and a proposed transactional local outbox. Shared audit types carry a unique event ID, actor/subject/workspace, resource/action, timestamp, request correlation, and safe metadata.

## Event catalog

| Event                                                           | Trigger                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `profile.viewed`, `profile.updated`                             | Authorized professional-data access/change                          |
| `contact.viewed`, `contact.updated`                             | Private contact access/change; update event extends source coverage |
| `resume.created`, `resume.generated`                            | Resume creation and accepted generation request                     |
| `resume.generation_completed`, `resume.generation_failed`       | Worker outcome; proposed lifecycle events                           |
| `resume.updated`, `resume.downloaded`, `resume.deleted`         | Version save, authorized download issuance/stream, deletion         |
| `member.invited`, `member.removed`, `member.role_changed`       | Membership actions                                                  |
| `member.accepted`, `member.suspended`, `profile.access_revoked` | Proposed consent/access changes under approved policies             |
| `authorization.denied`                                          | Sensitive denial with minimal safe context                          |

Record outcome semantics explicitly: download authorization/issuance does not prove the recipient read a PDF. Permission keys and event names are different contracts.

## Durability and privacy

Proposed D11 design: commit mutating state and its outbox intent together within the producer's database transaction; deliver internally with retry and idempotent event IDs. Sensitive reads need an agreed persistence/failure policy before release. Normal application identities cannot update/delete AuditEvent records; lifecycle retention uses a separate controlled process.

Allowlist metadata. No raw profile, contact, JD, tokens, signed URLs, or provider dumps. The audit reader needs active workspace access and `audit.view`; filters/cursors cannot cross scope.

## Acceptance and verification

- [ ] Required actions from every service produce correctly scoped, attributable events.
- [ ] Delivery retry produces one logical event; outage/recovery loses no committed mutation event.
- [ ] Contact access and denied sensitive actions follow the approved failure policy.
- [ ] Append-only application access and tenant-scoped audit queries are enforced.
- [ ] Audit UI handles pagination/filtering/errors without exposing sensitive metadata.
- [ ] Retention/deletion behavior is documented and tested; no unverified compliance claim is made.

## Suggestion lifecycle evidence — 2026-09-29 planning update

Add proposed resume.suggestion_requested, resume.suggestion_ready, resume.suggestion_failed and resume.suggestion_discarded events with safe IDs/status. Apply emits resume.updated linked to suggestion/base/new-version IDs in the same transaction/outbox; this proves persistence, not just a displayed animation. Do not log instructions, proposed text or comparison bodies.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] Retries/discards/Apply produce attributable deduplicated events without private prompt or resume content in audit metadata.

2026-10-01: personal capture helper verified against local PostgreSQL, including domain rollback, duplicate event failure and withheld contact results on COMMIT failure. Production service coverage, retry/ingestion, append-only roles and retention acceptance remain open.

## Phase 1 local delivery foundation — 2026-10-02

- [x] Persist bounded relay claims, attempt counts, retry times, leases and safe failure codes. Retain blocked intents for remediation; never discard committed intents.
- [x] Workspace-owned ingestion validates personal scope and preserves event time/outcome/correlation. Event ID becomes the ledger primary key; equivalent retries converge and conflicting payloads cannot overwrite history.
- [x] Verify outage/recovery, lost acknowledgements, concurrent claims/ingestion, expired leases with stale-completion fencing, invalid scope/payload and acknowledgement commit failure in disposable local PostgreSQL databases.

`pnpm audit:deliver:local` now runs one bounded batch over authenticated loopback HTTP to workspace-service. The sole allowed local service identity is `local-audit-relay`, with a randomly generated server-only key stored in ignored `.local/audit-transport.env`; unknown service IDs, bad keys and browser-origin requests are rejected before ingestion. Requests are strictly validated and bounded to 16 KiB; replies to 1 KiB. Only a matching event acknowledgement after ledger COMMIT marks the outbox delivered.

Hosted supervision, production service identity/HTTPS policy, hosted privilege provisioning, broader denied-event capture, shared-workspace ingestion, service coverage, viewer and retention remain pending. The full Phase 4 acceptance checklist above is not complete.

- [x] Local HTTP authentication/validation tests and disposable PostgreSQL HTTP recovery cases pass, including lost acknowledgement and ledger COMMIT failure. Manual commands and local-only limits are in [database notes](../../docs/database-foundation.md).

- [x] Separate restricted local producer/relay/ingestor DB roles preserve capture→HTTP→ledger delivery while every normal runtime role is denied ledger UPDATE/DELETE/TRUNCATE. Producer outbox access is INSERT only; relay cannot modify intent payload/event identity. Hosted provisioning, viewer access and retention remain pending. See [runtime role verification](../../docs/runtime-database-roles.md).

- [x] Automatic local relay scheduling uses the restricted role, fixed safe telemetry, bounded sequential passes and persisted retry/lease recovery; idle/active shutdown and restart after lost acknowledgements are verified. `pnpm audit:worker:local` starts the foreground worker; no hosted daemon/supervisor is installed. See [local worker](../../docs/database-foundation.md).

## Private profile coverage — 2026-10-03

- [x] Professional GET/PUT capture `profile.viewed`/`profile.updated` before a response escapes. Audit COMMIT failures withhold reads and roll back updates; no contact/professional text enters event metadata.
- [x] Denied workspace selectors capture `authorization.denied` in the actor's verified own workspace. Restricted local HTTP ingestion accepts only those workspace-scoped denials alongside existing success intents; foreign/denied profile-resource IDs and conflicting identity reuse remain rejected.
- [x] Verify capture→restricted relay→HTTP→ledger, retry/idempotency and rollback in `pnpm db:test:profile` (13 passes) and regress existing delivery in `pnpm db:test:audit` (12 passes).

Contact/section routes, all-service denial coverage and the full Phase 4 viewer/retention acceptance remain pending. See [profile API](../../docs/profile-api.md).
