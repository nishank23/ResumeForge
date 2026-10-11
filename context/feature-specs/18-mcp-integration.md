# F18 — Workspace-Aware MCP Integration

## Audited status — 2026-10-11

**Not started.**

- [ ] Seven tools are specified in documentation; no MCP server, SDK integration or registered tools exist.

**Remaining:** Transport/auth, adapters using existing authorized use cases, run handles, client configuration and REST/MCP parity tests all need building. Cover-letter and arbitrary storage tools stay excluded.

This snapshot supersedes dated implementation/pending statements below. Full acceptance stays unchecked where integration or verification is missing. [Complete audit](../../docs/implementation-audit.md).

**Phase:** 5 — Advanced · **Priority:** Medium · **Implementation:** Not started (audited 2026-10-11)

## Goal and dependencies

Expose reusable resume/profile operations to authorized clients using the same use cases and policy as REST. Requires stable domain contracts, F14 privacy, F15 audit, F17 analysis, and a reviewed MCP authentication/deployment choice. Read [mcp-integration.md](../../docs/mcp-integration.md).

## Ownership and planned files

Proposed `mcp/` sidecar entrypoints or service-local adapters for profile/resume/storage, shared input/output schemas, authenticated service clients, and integration tests. Final adapter placement is an implementation choice recorded before creation; do not put protocol/auth code in resume-core.

## MVP tools

`get-profile`, `list-resumes`, `list-templates`, `parse-jd`, `score-ats`, `analyze-skill-gap`, and `generate-resume`. `generate-cover-letter` remains disabled and outside Phase 5. Storage sidecar plumbing must not expose arbitrary bucket operations without an approved tool contract.

Derive actor identity from authenticated transport/session. The source's actorToken argument is illustrative, not permission to log credentials in tool payloads. A workspaceId parameter selects a workspace and must be resolved against current membership and resource access.

## Execution contract

Validate schema/limits, invoke the same authorized application operation as REST, serialize the same privacy-filtered DTO, and record an attributable audit event. Long-running generation returns an owned run/resource handle and safe status; it does not hold an unbounded tool call open. Mutation retries use idempotency identities.

Treat user content and tool descriptions as untrusted data within the calling application. Return grounded result content and structured safe errors, never raw secrets, private task outputs, or unrestricted artifact URLs.

## Acceptance and verification

- [ ] REST and MCP produce equivalent allowed/denied outcomes for the same actor/workspace/resource/action.
- [ ] Role changes, revoked membership, token expiry, wrong workspace IDs, and malformed inputs are rejected.
- [ ] Restricted contact never appears in any MCP result or linked artifact.
- [ ] Retried generation creates one logical operation; task handles cannot be used across scope.
- [ ] Integration client setup, transport/auth requirements, and verified tool schemas are documented.
- [ ] Cover-letter and arbitrary storage tools are not advertised as available.

Future recruitment clients may consume these interfaces; recruitment domain features remain outside this product.

## No implicit assistant tool expansion — 2026-09-29 planning update

Keep seven planned MCP tools. Performative UI is a browser-only dependency, and contextual suggestion/apply endpoints do not automatically become public tools. Future editing tools require a separately reviewed contract; generate-resume must not become an unrestricted section-patch shortcut.

References: [frontend integration](../frontend-integration.md), [contextual editing contract](../resume-editing-contract.md).

- [ ] REST/MCP parity and tool enumeration retain the seven-tool scope, master-profile immutability and private version/provenance boundaries.
