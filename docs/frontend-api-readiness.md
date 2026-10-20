# Frontend API readiness

## Current integration — 2026-10-14

| Capability | Status | Source |
| --- | --- | --- |
| Google session and protected shell | ✅ Connected; signed-in landing is the resume library. | [Auth app](../services/auth-service/src/app.ts), [shell](../apps/shell/src/App.tsx) |
| Optional basic master profile | ✅ Create/read/professional draft update connected. | [Profile remote](../apps/profile-mfe/src/ProfileRemoteRoot.tsx) |
| Resume library and saved editor | ✅ Owned create/list/load/update, rename, confirmed tombstone deletion/undo and saved PDF. | [Resume remote](../apps/resume-mfe/src/ResumeRemoteRoot.tsx), [gateway](../services/gateway/src/app.ts) |
| File intake | ✅ Local PDF/DOCX/TXT/MD staging and explicit version-save through /resume/parse. Raw source viewers disabled behind a flag. | [Import dialog](../apps/resume-mfe/src/ResumeImportDialog.tsx) |
| General readiness | ✅ Version-bound readiness-v2 with grouped actions, stale/error/retry and score-neutral dismissal. | [ATS use cases](../services/resume-service/src/ats/use-cases.ts) |
| JD matching and selected rewriting | ✅ Local rules; optional paid Gemini evidence, private retrieval and reviewed target-only Apply. No checkbox prerequisite in current dialogs. | [ATS workflow](ats-workflow.md) |
| Templates | ✅ Classic/Modern/Editorial styles, immutable appearance saves and PDF integration. | [Template registry](../apps/resume-mfe/src/templates/registry.ts) |
| Master section/contact/complete APIs | Partial: profile-service handlers exist but gateway/browser forms do not expose them. Contact permissions/events need repair. | [Profile app](../services/profile-service/src/app.ts) |
| Clone, version browsing and JD history | Partial: backend handlers exist but personal allowlist/gateway/UI do not connect them. | [Resume app](../services/resume-service/src/app.ts) |
| Full saved-source JD tailoring | ✅ Guided confirmed experience, scoped batches, restored owned progress, review/reject/preview and independent-copy save/PDF. | [Contract](full-resume-tailoring.md) |
| Legacy generation/suggestions/Apply | Gated; client-authoritative Apply and other unsafe suggestions remain unapproved. | [Audit](implementation-audit.md) |
| Shared workspaces and audit viewer | Partial backend only; no released workspace flow. | [Workspace service](../services/workspace-service/src/workspace.ts) |
| R2, general task orchestration, LinkedIn archive import, MCP | Not connected; bounded tailoring progress is persisted in resume metadata. | [Product plan](../PLAN.md) |

Setup is in [README](../README.md). Start the approved personal stack; root pnpm dev includes unfinished services and is not the supported full-app launcher.

Historical provider instructions selecting Textkernel/OpenCode/MiMo, readiness-v1-only scoring, mandatory profile creation or fictional samples are superseded. Current Gemini uses server REST adapters and the approved paid mode. Saved legacy schemas do not imply live provider integration.

## Next integration gate

The first saved-source tailoring slice is approved and connected through /tailoring routes. Native development uses `pnpm dev:personal` with source watchers. Next: synthetic calibration and reviewed master-profile intake. URL JD intake, DOCX, tracker, billing and cover-letter modules remain planned. Shared access retains contact/role/consent/runtime gates.
