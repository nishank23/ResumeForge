# Development workflow

## Current scope

Work on feature in the organization checkout /Users/nishankbansal/Downloads/ResumeBuilderv2. Use organization explicitly for Git publishing; personal origin and other worktrees are separate. Preserve private .env/.local, databases and credential volumes.

Branch preparation, documentation cleanup and the first [Phase 1 slice](../PLAN.md) are authorized: saved resume + pasted JD, grounded proposals, review, independent-copy save and PDF. Use pnpm watchers for development. This does not activate later roadmap phases, new providers, billing or shared access. Old context-review gates do not need reopening; archived phase instructions do not authorize new work.

## Work loop

1. Inspect status/diff and [task ownership](development-status.md). Preserve others' changes.
2. Read AGENTS.md, PLAN.md, the [current audit](../docs/implementation-audit.md), [tracker](progress-tracker.md) and relevant live domain contracts.
3. Use CodeGraph first for indexed code. Trace the responsible owner/seam; choose a bounded end-to-end slice with observable acceptance.
4. After approval, claim the task. Keep types, Zod validation, ownership/privacy, immutable versions, provider limits and audit atomicity intact.
5. Verify the meaningful success, invalid, unauthorized, stale/replay and failure cases appropriate to the change. Record actual commands and limitations.
6. Update affected contracts and the tracker, then finish only the owned task. Plans, handlers and historical tests do not prove a released feature.

Ask about product decisions at dependent boundaries. Routine reversible implementation details can use judgment. Do not add services, providers, dependencies or feature modes without a lifecycle/acceptance reason.

Scheduled work must respect the approved slice, active task lock and allowed paths. Parallel agents need explicit assignment and branch/path ownership; do not dispatch them automatically. README contains only product overview, stack, setup and run/build; task state belongs here.
