# Frontend integration

The shell owns session bootstrap, routing, theme and remote error recovery. Auth/profile/resume remotes receive a narrow browser-safe context. Preserve shared React instances and scoped identity; changing workspaces or signing out must clear private state.

Implemented integration includes Google sign-in, direct resume-library landing, modal upload review, saved editing, grouped readiness/JD feedback, exact-target Gemini proposals, saved PDF and three appearance styles. Full tailoring checks JD gaps locally, offers at most three locally selected optional questions across the resume, one at a time, with a saved-facts path and editable earlier answers, confirms answers before provider processing, restores owned run progress, supports per-proposal rejection/preview and opens an independent saved copy. Basic master-profile fields are connected; full section forms and commercial flows are not.

Shared [StudioLoading](../packages/shared/src/components/ui/studio-loading.tsx) serves session/federation/list/editor/profile requests with generic workspace copy, real request lifetime and quiet-motion support. Saving/creation/AI feedback remains specific. Earlier verification is retained in the [archive](../docs/archive/README.md); new source inspection is not fresh browser evidence.

The shell HTML supplies an inline resume-scan screen before JavaScript starts and keeps it through session/federation startup. A small DOM observer reveals real main content or recovery UI immediately, restores root interaction/accessibility and cleans up its listeners and timer. Production builds preload core federation dependencies while preserving lazy features. The public demo received the corresponding HTML-only updates on 2026-10-15; [cold-visit measurements, design checks and rollback](../docs/cold-start-loading.md) distinguish this deployment from the separate organization feature work.

Performative UI remains behind shared adapters. Prompt submission uses authenticated APIs; backgrounds are decorative and isolated; validated-response playback never represents hidden model reasoning. Tiptap and printable/PDF content remain separate from app effects.

Follow the [editing contract](resume-editing-contract.md), [API readiness](../docs/frontend-api-readiness.md), [tailoring contract](../docs/full-resume-tailoring.md) and [current audit](../docs/implementation-audit.md). Later expansion is in [PLAN.md](../PLAN.md); do not expose gated legacy generation/clone/Apply routes wholesale.

New queued tailoring requests refresh the existing session grant first. Failed refresh, logout and identity changes prevent submission; worker expiry checks remain unchanged. Progress remounts its decorative spinner when stages change so visible and accessible labels agree.
