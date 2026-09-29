# Phase 5 Build Plan — Advanced Features and MCP

**Features:** F16–F18. **State:** Not started. **Goal:** Add safe profile import, grounded gap insights, and reusable secured integrations.

## Entry conditions

Phase 4 policy/audit is verified. Supported archive formats/limits, semantic model versions, import retention, and MCP transport/auth deployment choices are documented before their respective implementation slices.

## Task P5.1 — LinkedIn import (F16)

Planned files: profile-service upload/parse/review/confirm contracts, parsing task, import review UI, temporary artifact cleanup.

- [ ] Verify supported formats using official provider documentation and synthetic/authorized sample archives.
- [ ] Implement [F16](../feature-specs/16-linkedin-import.md) bounded parsing, source mapping, conflicts, explicit preview and selected merge.
- [ ] Apply contact permissions and optimistic profile revisions on confirmation, then invalidate derived embeddings.
- [ ] Verify malicious archive, duplicate import, cancellation, stale revision, cleanup, and cross-tenant access cases.

## Task P5.2 — Gap analysis (F17)

Planned files: domain gap analyzer, provider/embedding adapters, service result contract, resume-MFE gap panel.

- [ ] Implement [F17](../feature-specs/17-keyword-gap-analysis.md) with evidence and supported-vs-missing distinctions.
- [ ] Version/cache by exact input identity and expose unavailable/stale semantics honestly.
- [ ] Verify no analysis mutates a profile/resume or inserts unsupported qualifications.

## Task P5.3 — MCP adapters (F18)

Planned files: approved sidecar/service adapter location, validated tool schemas, authenticated service client, client setup docs.

- [ ] Validate current SDK/transport requirements and implement [F18](../feature-specs/18-mcp-integration.md) over existing authorized use cases.
- [ ] Register only the seven in-scope tools; leave cover-letter/storage extras unavailable.
- [ ] Reuse run ownership, idempotency, privacy projection, and auditing for async actions.
- [ ] Verify REST/MCP parity for every applicable role/workspace and denied/revoked/stale-token cases.

## Task P5.4 — Integration release review

- [ ] Demonstrate reviewed import → updated master profile → gap analysis → new tailored resume without altering older versions.
- [ ] Demonstrate an authorized external client uses the engine via MCP with the same restrictions as the UI/API.
- [ ] Update API/MCP/deployment docs with actual verified behavior and record remaining limitations.

## Exit gate

All F16–F18 acceptance criteria pass. Import is explicit/reviewed, gap output is grounded, and MCP has no privileged bypass. Additional templates/settings belong to proposed Phase 6 F20; F19 file intake is separate from F16. Cover letters and billing remain unallocated; recruitment stays excluded.

## Advanced-flow integration with contextual editing

- [ ] Open supported F17 recommendations in the same explicit section-suggestion flow; never insert missing evidence automatically.
- [ ] Keep reviewed LinkedIn facts separate from resume edits; require a new request to use changed profile data.
- [ ] Preserve the seven-tool MCP catalog; any future suggestion/apply tools need a separate reviewed extension.

See [editing contract](../resume-editing-contract.md). D14 generic resume-file intake is not part of F16 by implication.
