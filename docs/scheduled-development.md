# Scheduled local development

The existing Codex heartbeat checks this chat every **15 minutes**. It uses the README current-task marker and the canonical [progress tracker](../context/progress-tracker.md), rather than a second task queue. Keep the Mac awake, Codex running and the project available. This is a scheduled wakeup, not a continuously running server or a guarantee that every check can execute when permissions or services are unavailable.

## Branch ownership — 2026-10-08

The user retains the managed worktree `/Users/nishankbansal/.codex/worktrees/frontend/ResumeBuilderv2` and replaces the retired frontend/backend remote branches with `features` after integrating completed work into main. A scheduled launcher may still start in the original checkout; set every repository command/edit to the managed worktree and verify `features` before reading task state or choosing work. The original folder remains detached at `0dc79ec`, with no new implementation. On main, a retired branch or any unexpected branch in the designated worktree, perform no development and report the mismatch once. On `features`, choose only an approved frontend slice; leave idle when backend dependencies remain blocked. Do not recreate the old remote branches or start the historical backend prompt without a fresh branch/path assignment. The existing heartbeat cadence and notifications remain unchanged.

Task markers and ignored locks are local to each checkout, not a global lock across worktrees. Each agent must still honor its own ongoing task and owner token. File ownership and a single integration owner coordinate the two lanes; locks alone do not prevent shared database, API or dependency conflicts. Backend progress is recorded in its handoff document, then incorporated into the canonical tracker by Codex during integration.

## Each run

1. Run `pnpm task:status` before development. If ongoing, leave the task and working tree alone and wait for the next scheduled check. Never expire a task because 15 minutes have passed.
2. If idle, inspect status/recent diffs, the tracker, the CareerZenith review and the relevant specification. Preserve completed work. Choose one unfinished slice with satisfied dependencies within the current branch's ownership. The frontend lane must not take reserved backend foundation work.
3. Claim it with `pnpm task:start "Short slice title"`. Exit 2 means another run claimed it; stop. Keep the returned owner token until completion. The lock is ignored local state, not a credential.
4. Implement and run appropriate checks. Update the tracker with actual results, manual checks and blockers. CareerZenith is a capability reference; retain our architecture, identity, authentication and contact privacy. Do not label unavailable AI/ATS/PDF behavior or synthetic data as functional parity.
5. Finish with `pnpm task:finish OWNER "Verified outcome; remaining limitation"`. Finish also when a slice fails or hits an external blocker, after recording its actual state. No secrets, personal data, automatic pushes, deployment or messages to others.

If no authorized slice can progress, keep the marker idle and record the required input once in the tracker. Recheck later without repeating reports or bypassing open decisions. AI credentials are pending; continue independent local work. LinkedIn stays on hold. Embedding infrastructure can be set up without resolving the embedding model/dimensions in D07.

## Interrupted-run recovery

Missing/malformed README state, an orphaned lock, or mismatched ownership blocks new work. No automatic timeout steals ownership. Confirm in this chat that the previous run has stopped, inspect its changes and unfinished tracker task, then reconcile the marker and `.local/development-task.lock` together. A matching interrupted owner can finish normally when both exist; otherwise repair the marker to idle and remove only that confirmed stale lock. Do not remove the PostgreSQL directory or other `.local` files. Never recover while another run is active.

## Local checks

`pnpm task:status` prints the current effective status in the terminal. `pnpm task:test` exercises competing ownership, simultaneous processes, stale/malformed markers, owner-only release, preservation of README text and rejection of non-local vector setup. It uses disposable temporary directories and never claims the real task.

`pnpm db:local:start`, `pnpm db:vector:init` and `pnpm db:test:vector` start/check the loopback-only PostgreSQL cluster, enable pgvector idempotently in its development database and verify operators in an isolated disposable database. The vector test creates only synthetic 3-dimensional examples, then drops **its own** test database. It proves extension readiness, not application authorization, model compatibility or semantic relevance. Run existing `pnpm db:test:roles` after infrastructure changes to verify service database boundaries.

The extension stores vectors in PostgreSQL; a separate hosted vector service is not required. Real profile/JD/skill embedding columns, dimensions, model/version metadata, scoped repositories, indexes and AI calls still depend on D07 and later tracker slices. No provider credentials are written by these tools.
