# Frontend integration

The shell owns session bootstrap, routing, theme and remote error recovery. Auth/profile/resume remotes receive a narrow browser-safe context. Preserve shared React instances and scoped identity; changing workspaces or signing out must clear private state.

Implemented integration includes Google sign-in, direct resume-library landing, modal upload review, saved editing, grouped readiness/JD feedback, exact-target Gemini proposals, saved PDF and three appearance styles. Full tailoring restores owned run progress, supports per-proposal rejection/preview and opens an independent saved copy. Basic master-profile fields are connected; full section forms and commercial flows are not.

Shared [StudioLoading](../packages/shared/src/components/ui/studio-loading.tsx) serves session/federation/list/editor/profile requests with generic workspace copy, real request lifetime and quiet-motion support. Saving/creation/AI feedback remains specific. Earlier verification is retained in the [archive](../docs/archive/README.md); new source inspection is not fresh browser evidence.

Performative UI remains behind shared adapters. Prompt submission uses authenticated APIs; backgrounds are decorative and isolated; validated-response playback never represents hidden model reasoning. Tiptap and printable/PDF content remain separate from app effects.

Follow the [editing contract](resume-editing-contract.md), [API readiness](../docs/frontend-api-readiness.md), [tailoring contract](../docs/full-resume-tailoring.md) and [current audit](../docs/implementation-audit.md). Later expansion is in [PLAN.md](../PLAN.md); do not expose gated legacy generation/clone/Apply routes wholesale.
