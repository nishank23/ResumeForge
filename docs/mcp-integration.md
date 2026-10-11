# Planned MCP Integration

## Current audit status — 2026-10-11

Not started: the seven-tool contract below has no MCP server/SDK/registered tools. Future adapters must reuse authorized use cases; this specification is not an active service.

See the [full source-linked audit](implementation-audit.md). Dated checkpoints below remain history.

**Phase 5 design; no MCP server/tools are implemented.** Use [F18](../context/feature-specs/18-mcp-integration.md) as the feature checklist and [authorization-model.md](../context/authorization-model.md) as policy authority.

## Adapter boundary

Profile/resume/storage sidecars may wrap service use cases through authenticated internal clients. They must not duplicate persistence logic or bypass the services' policy. The workspace-independent resume engine does not know MCP, actors, or tenant IDs.

Choose transport, protocol/SDK version, service registration, and client-authentication mechanism using current official SDK documentation when implementing. Derive actor identity from a validated session/transport token. Do not require a model to echo credentials as ordinary tool arguments; the source plan's actorToken field is illustrative.

## Tool contracts

All tools accept a workspace selector that is validated against current access. Optional target IDs are always resolved inside that scope.

| Tool | Domain input | Output | Required capability |
|---|---|---|---|
| `get-profile` | profileId or self | Sanitized professional DTO; contact only through approved explicit policy | profile.read; contact requires profile.contact.read |
| `list-resumes` | cursor, bounded filters | Scoped summaries and next cursor | resume.read |
| `list-templates` | supported filters | Available template IDs/versions | template.view |
| `parse-jd` | profileId, bounded JD text, idempotency identity | Parsed JD or owned run handle | profile access + resume.create under current draft |
| `score-ats` | version/resume ID, JD ID | Versioned five-component result or run handle | ats.run plus input read access |
| `analyze-skill-gap` | profile/version + JD | Evidence-based gaps and provenance | skillgap.analyze plus input read access |
| `generate-resume` | profileId, JD input/reference, templateId, idempotency identity | Owned resume/run handle and sanitized status | resume.generate + create/input authority |

`generate-cover-letter` is not registered through Phase 5. An internal storage sidecar is not authorization to expose generic bucket/key access. Any future public storage tool requires its own scoped contract and review.

## Async behavior and errors

Long-running work returns a durable handle, not a promise to hold a connection indefinitely. Define status retrieval through the same authorized run contract as REST and verify current access each time. Use structured validation/unauthorized/forbidden/not-found/conflict/rate-limit/provider-failure errors with safe messages. No raw stack traces, private job output, or signed URLs in ordinary error/audit logs.

Resource and task retries require idempotency. MCP output remains untrusted content to its consumer; tools do not instruct a caller to disable authentication, expose credentials, or perform unrelated operations.

## Verification

Run parity fixtures for every applicable role and workspace: same actor, action, inputs, and resource must produce equivalent REST/MCP authorization and privacy results. Cover revoked sessions/memberships, cross-tenant IDs, guessed task handles, repeated mutation requests, and contact-bearing historical artifacts. Document a working client example only after the server and chosen transport exist.

## Contextual editing boundary

Performative UI is browser presentation only. The [section-suggestion flow](../context/resume-editing-contract.md) adds REST capabilities without changing the seven registered Phase 5 tools. Do not overload generate-resume to silently apply a selected-section edit, and do not expose arbitrary patch execution through MCP. A future suggest/apply tool pair needs its own reviewed mutation/confirmation, permission, revision and retention contract. Existing tools preserve version provenance and never modify the master profile as a side effect.

## U06 expansion boundary

F19 import and F20 appearance mutations add no MCP tools. Existing list-templates can expose authorized catalog/preset metadata after F20 implementation, without resume/contact payloads. Generation may accept only available authorized template identity/settings under a reviewed input schema; no arbitrary render code. Cover letters remain inactive through proposed Phase 6.
