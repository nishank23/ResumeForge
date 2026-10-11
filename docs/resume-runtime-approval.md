# Approved local resume runtime access

## Current audit status — 2026-10-11

The approved restricted personal resume role is implemented. Current allowlist also supports private vector cache reads/inserts/deletes alongside versioned editor/scoring/rewrite/PDF use cases. Approval history below is not a request to reprovision credentials.

See the [full source-linked audit](implementation-audit.md). Dated checkpoints below remain history.

Needed for the user's requested database-backed resume create/upload/save flow. The user explicitly approved this restricted local role on 2026-10-04. It has been provisioned in the loopback development database, and startup grant assertions and disposable role/persistence tests pass.

Create one local login role, `rf_local_resume`, in the existing loopback PostgreSQL cluster. Store its generated password only in the primary checkout's ignored `.local/runtime-database.env`, mode 0600. Keep all existing role passwords unchanged. Resume service must refuse the administrator login and assert the exact role/grant matrix at startup.

| Table         | Approved access                                                                                      | Purpose                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Workspace     | SELECT only id, type, personalOwnerUserId                                                            | Recheck personal ownership                                         |
| UserProfile   | SELECT only id, userId                                                                               | Existing profile FK                                                |
| UserProfile   | INSERT only id, userId, fullName, createdAt, updatedAt                                               | Empty internal anchor if absent; no professional or contact import |
| Resume        | SELECT, INSERT                                                                                       | Owned drafts                                                       |
| Resume        | UPDATE only content, currentVersion, updatedAt, templateId, status, atsScore, atsBreakdown, pdfR2Key | Manual version saves and stale artifact invalidation               |
| ResumeVersion | SELECT, INSERT                                                                                       | Immutable history                                                  |
| AuditOutbox   | INSERT                                                                                               | Atomic sanitized audit intent                                      |

No UserContact, User, OAuthAccount, Session, profile-section, task, audit-read or database/schema creation grants. No DELETE, role membership, grant option, superuser, replication or RLS bypass. Server queries still enforce authenticated actor and workspace scope: table grants alone cannot enforce row ownership. Role compromise could expose private resume JSON stored in these two tables; this is why this persistent access requires approval.

The 2026-10-08 explicit user request adds owned recoverable DELETE, POST restore and GET saved-version PDF to create, parse, list, load and manual save. These use only the already approved Resume status/pdfR2Key update, ResumeVersion read and AuditOutbox insert grants. No role/password/grant or migration change is needed. Deleted versions remain retained; permanent purge is not enabled. PDFs are authenticated owner-only streams with retrieval rechecks; no public/storage link or provider transfer occurs. AI, legacy direct import, protected-contact APIs, generation and sharing remain disconnected. Port 4003 belongs to resume-service; workspace business service remains stopped. No application migration or existing-user resume insertion occurs during setup.

Approval permits adding this role/grant definition, provisioning it through the existing managed runtime initializer, and starting the local resume service. All UI and disposable test work can proceed first.

## General readiness extension — 2026-10-09

The approved no-JD scoring request adds personal GET/POST readiness and PUT feedback preferences. These read owned Resume/ResumeVersion snapshots and update only existing atsBreakdown metadata, with sanitized AuditOutbox capture. They use existing Workspace ownership reads and existing grants; no role, password, privilege or schema change occurs. Pure scoring receives a visible professional projection excluding header/contact/extraction-source data. Nothing is sent to an AI or parsing vendor. Shared activation remains disabled.

## Requested vector retrieval extension — 2026-10-09

The user's vector-search request adds SELECT/INSERT/DELETE on the derived ResumeSearchChunk cache only. RLS restricts owner/workspace/current-version reads/inserts; source tables remain append-only or update-limited. Resume runtime receives EXECUTE only on vector_in(cstring,oid,integer), vector_out(vector), vector_typmod_in(cstring[]), cosine_distance(vector,vector) and vector(vector,integer,boolean). All other public functions remain denied. The owner-controlled invalidation trigger can delete only derived cache and cannot be invoked directly by runtime roles. No UserContact/OAuth, source DELETE, cache UPDATE or DDL grant is added. Local provisioning preserved existing credentials; restricted-role and lifecycle tests passed. [Details and rollback](resume-vector-search.md).
