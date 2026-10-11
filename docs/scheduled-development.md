# Scheduled local development

## Current workflow — 2026-10-11

Use the **fixes** branch in /Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2. Preserve the detached primary checkout and its private database/configuration. Historical frontend/backend/features/ux-ui-update branch names are superseded; do not recreate them. See [branch ownership](parallel-development.md).

Task ownership now lives in [context/development-status.md](../context/development-status.md), separate from the product README. The ignored .local/development-task.lock is local to this checkout, not a global database/API lock. Only the matching owner can release it.

The historical heartbeat was configured for 15-minute checks. Its current enabled state was not inspected in the documentation audit; these instructions do not create or change a scheduler.

## Each authorized run

1. Run `pnpm task:status`. If ongoing, preserve the owner's task and wait. Elapsed time does not expire ownership.
2. If idle, inspect Git status/diff, the [tracker](../context/progress-tracker.md), [audit](implementation-audit.md) and relevant contracts. Select one authorized incomplete slice with satisfied dependencies.
3. Claim it with `pnpm task:start "Short slice title"`. Exit 2 means another owner claimed it. Retain the returned owner token.
4. Implement only that slice, verify it, then record actual results and limitations in the tracker. Personal editing, PDF, scoring, Gemini and private retrieval already exist; do not rebuild them from old starter prompts.
5. Release with `pnpm task:finish OWNER "Verified outcome; remaining limitation"`, including after a failed or blocked slice once its actual state is recorded.

No authorized work available: leave idle. A scheduled wakeup does not authorize pushes, deployments, external messages, broad database changes or new provider processing. LinkedIn import, shared activation and durable jobs remain incomplete.

## Recovery and verification

Malformed state, orphaned locks or owner mismatch block a new claim. Confirm the previous run stopped before reconciling the status document and lock together. Do not automatically steal ownership or remove unrelated .local files.

`pnpm task:test` uses temporary repositories for ownership/race/recovery tests and verifies that claim/finish leave README unchanged. It also checks local vector configuration. It does not claim the real task.

Database setup and app launch are in the [README](../README.md). Run credential initialization in the primary checkout only. Vector operator smoke tests establish extension readiness; current application embeddings use Gemini/768-dimensional private resume chunks and have separate authorization/invalidation tests. See [vector search](resume-vector-search.md) and [runtime roles](runtime-database-roles.md).
