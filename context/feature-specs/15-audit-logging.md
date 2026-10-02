# F15 — Audit Logging and Viewer

**Phase:** 4 — Multi-Tenant · **Priority:** Medium · **Implementation:** Phase 1 intent validation, atomic capture and local personal retry/ingestion implemented; cross-service transport/viewer pending

## Goal and dependencies

Make sensitive activity attributable without retaining sensitive payloads in logs. Event/schema/capture foundations start in Phase 1; this phase completes durable cross-service ingestion, tenant audit viewing, and coverage verification. Requires D11 retention/failure policy and F13/F14's scope.

## Ownership and planned files

Workspace service owns AuditEvent ingestion/query APIs and the shell audit viewer. Each service owns capture of its domain actions and a proposed transactional local outbox. Shared audit types carry a unique event ID, actor/subject/workspace, resource/action, timestamp, request correlation, and safe metadata.

## Event catalog

| Event | Trigger |
|---|---|
| `profile.viewed`, `profile.updated` | Authorized professional-data access/change |
| `contact.viewed`, `contact.updated` | Private contact access/change; update event extends source coverage |
| `resume.created`, `resume.generated` | Resume creation and accepted generation request |
| `resume.generation_completed`, `resume.generation_failed` | Worker outcome; proposed lifecycle events |
| `resume.updated`, `resume.downloaded`, `resume.deleted` | Version save, authorized download issuance/stream, deletion |
| `member.invited`, `member.removed`, `member.role_changed` | Membership actions |
| `member.accepted`, `member.suspended`, `profile.access_revoked` | Proposed consent/access changes under approved policies |
| `authorization.denied` | Sensitive denial with minimal safe context |

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

`pnpm audit:deliver:local` runs one bounded batch against the managed local development database using trusted in-process composition. It exposes no HTTP route and does not authenticate future service callers. Automatic scheduling, authenticated transport, append-only runtime privileges, denied-event capture, shared-workspace ingestion, service coverage, viewer and retention remain pending. The full Phase 4 acceptance checklist above is not complete.
