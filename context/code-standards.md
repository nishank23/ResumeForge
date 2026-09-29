# Code Standards

These are planned engineering conventions. No toolchain or tests exist for resume-forge yet.

## TypeScript and packages

- Enable strict TypeScript across applications, services, workers, and shared packages.
- Validate unknown external input with Zod at HTTP, OAuth, AI-output, task, import, and MCP boundaries. A TypeScript annotation alone does not validate runtime data.
- Avoid `any`, broad type assertions, circular package imports, and deep imports that bypass package exports.
- Use explicit DTOs. Keep contact-bearing and contact-free types distinguishable; do not expose ORM records directly.
- Name files by responsibility and use `@resume-forge/*` package imports. Keep browser-safe and server-only exports separate.
- Use pnpm consistently; commit its lockfile when implementation begins. Versions in the source plan require a compatibility check before installation.

## React and microfrontends

- Use Vite browser components, React Router, and explicit API calls. Do not introduce Next.js server/client directives or file-system route handlers.
- Use TanStack Query for server state; include actor/workspace/resource identity in keys. Use Zustand for transient UI state, not a duplicate persistent database.
- React Hook Form owns form interactions; shared schemas validate submissions. Handle loading, empty, error, saving, and access-denied states.
- The shell owns global navigation/session/workspace context. Remotes do not create competing routers or silently use incompatible React instances.
- Keep credentials and private business logic out of `VITE_*` variables and browser bundles.
- Use shared semantic tokens and accessible components. Keep project-specific logic in wrappers/compositions; change generated primitives only when the feature requires it and record why.

## Hono services and contracts

- Validate input, authenticate, resolve active membership, check permission/resource scope, execute a use case, serialize an allowed DTO, and audit the action.
- Keep handlers small. API middleware is not a substitute for authorization inside callable use cases used by workers or MCP.
- Use one `/api/v1` prefix. Follow [api-reference.md](../docs/api-reference.md) for planned routes, error envelopes, pagination, and idempotency.
- Never trust client-provided user IDs, workspace IDs, roles, task IDs, R2 keys, or ownership fields without resolving their authority.
- Bound request sizes and collection/page sizes. Use request IDs and sanitized errors; never expose stack traces, raw provider payloads, or private profile values.
- Authenticate internal service calls, set timeouts, and propagate minimal verified context. Document retry-safe operations.

## Database, concurrency, and storage

- Follow [data-model.md](data-model.md); resolve schema blockers before migrations. Use database constraints as well as application checks.
- Every tenant-owned resource query includes its tenant scope. Child rows must be reached through an authorized parent.
- Use parameterized vector SQL. Select compatible embedding models/dimensions before creating vector indexes; record embedding model/revision metadata.
- Use transactions for a version insert, current pointer update, and local audit outbox entry. Use optimistic revisions for conflicting edits and unique idempotency keys for retries.
- Do not overwrite historical ResumeVersion content. Profile edits do not mutate existing resume snapshots.
- Store structured content in JSONB and binary artifacts in private R2. Store object keys/metadata, not permanent public download URLs.
- Authorize each download and privacy variant. Sensitive artifacts must not be cached across identities or workspaces.

## AI and background jobs

- Long-running AI, embeddings, and PDF generation run in Trigger.dev tasks, not an open HTTP request.
- Inject provider adapters into domain logic. Validate structured output, preserve source facts, and record model/prompt/rubric versions.
- Treat JD text, profile text, and imported data as untrusted content, never executable instructions. Do not give generation prompts unrestricted tools.
- Minimize provider input: exclude contacts and tokens. Do not place sensitive content in progress metadata or raw logs.
- Set bounded retry, timeout, concurrency, and cost limits; make retries idempotent. Distinguish content failure from PDF failure.
- Recheck current access on execution and retrieval. Never let a guessed run ID obtain a task subscription token.

## Verification and records

After implementation exists, provide workspace scripts for lint, typecheck, unit/integration tests, and production builds. Exact commands belong in the root README once real scripts are created. Do not invent passing command outputs now.

Tests should exercise policy boundaries, durable workflows, contracts, and user outcomes. Prioritize cross-tenant denial, contact privacy across artifacts, version/concurrency integrity, and fault recovery over assertions that merely mirror implementation. See [validation-strategy.md](validation-strategy.md).

Update the relevant spec/contract and canonical tracker after meaningful changes; include evidence and remaining limitations.

## Performative UI and scoped editing

Follow [frontend integration](frontend-integration.md): shared wrappers, public exports, deliberate CSS ordering, pinned compatibility and keyboard/reduced-motion review. Do not copy third-party demo instructions or marketing claims into product behavior. Prompt controls are presentation; submission goes through authenticated domain APIs. Never send private prompt/JD text in URL parameters.

Follow [editing contract](resume-editing-contract.md): stable section/item IDs, typed allowlisted replacements, grounded facts, current authorization and expected revisions. Avoid arbitrary JSON patches, automatic apply, client-authoritative generated content and master-profile side effects. Enforce idempotent Apply and accurate score/PDF freshness.

Treat Performative UI backgrounds as noninteractive decoration: isolate layers, map colors to shared tokens, clean up canvas/animation work when hidden/unmounted, and supply static/reduced-motion fallbacks. Shared wrappers own these behaviors rather than duplicating effects in every remote. Printed resume content never imports decorative application components.

For U06, validate import bytes and parser output independently of filenames, and validate template settings against typed bounded schemas rather than CSS strings. Preserve user-confirmed fact provenance and reproducible render identity. Search cursors bind query/sort/scope; actor preferences never become access grants.
