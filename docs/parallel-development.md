# Branch and worktree ownership

## Canonical personal checkout — 2026-10-20

The user approved moving the complete organization feature into personal private `nishank23/ResumeForge`. The canonical independent clone is `/Users/nishankbansal/Downloads/ResumeForge`; `origin` points to the personal repository. Use `codex/` branches for changes and verified `main` for the existing cloud release pipeline.

Older organization/frontend/backend checkouts are transfer sources. Preserve their refs, dirty patches, untracked files and private settings before retirement. Do not remove remote organization branches or treat historical handoff documents as current assignments.

Worktrees share Git objects/remotes and do not isolate databases, credentials, API contracts or dependency conflicts. Preserve primary .env/.local and normal database/credential volumes. Do not initialize competing runtime passwords.

The first saved-source tailoring slice is approved; later phases remain separate decisions. Before any future parallel work, establish a committed baseline, explicit branch/path ownership, allowed/forbidden files, exact checks and one integration owner. Do not dispatch agents automatically, switch another checkout or publish their changes without authorization.

Task ownership lives in [development-status](../context/development-status.md). Historical branch/handoff assignments are archived and are not current authorization.
