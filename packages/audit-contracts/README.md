# `@resume-forge/audit-contracts`

Validated, content-free audit event intents shared by server entrypoints and
workers.

This Phase 1 package defines event vocabulary, scope fields, outcome semantics,
and an allowlist for safe identifier/status metadata. It does not persist or
deliver events. Transactional outboxes, retry behavior, sensitive-read failure
policy, retention, and deletion remain gated by D11.
