# Branch and worktree ownership

## Organization checkout — 2026-10-14

The current task uses feature in /Users/nishankbansal/Downloads/ResumeBuilderv2. Organization remote: resuming-v2/ResumeForge. Personal origin: nishank23/ResumeForge. Worktree-scoped Git defaults and feature's upstream target organization. Organization branches retain main and feature after merged-branch cleanup.

Do not rename shared remotes or change personal worktree defaults. Use organization explicitly for fetch/push/PR work here. Other local branches/worktrees, including personal cloud-deploy and backend checkouts, are preserved; this document assigns no work to them.

Worktrees share Git objects/remotes and do not isolate databases, credentials, API contracts or dependency conflicts. Preserve primary .env/.local and normal database/credential volumes. Do not initialize competing runtime passwords.

The first saved-source tailoring slice is approved; later phases remain separate decisions. Before any future parallel work, establish a committed baseline, explicit branch/path ownership, allowed/forbidden files, exact checks and one integration owner. Do not dispatch agents automatically, switch another checkout or publish their changes without authorization.

Task ownership lives in [development-status](../context/development-status.md). Historical branch/handoff assignments are archived and are not current authorization.
