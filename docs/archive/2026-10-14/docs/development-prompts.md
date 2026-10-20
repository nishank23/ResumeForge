> Historical snapshot archived 2026-10-14. See [the current product plan](../../../../PLAN.md) and active documentation. This file is not current implementation authorization.

# Development starter prompts

## Current starting point — 2026-10-11

The personal resume-first flow is implemented: Google sign-in, owned resume library, reviewed file intake, immutable saves, manual editor, three template styles, general readiness/JD matching, paid Gemini scoped suggestions and saved PDF streaming. Preserve these modules and the latest four UI fixes.

Use [AGENTS.md](../AGENTS.md), [implementation audit](implementation-audit.md), [feature register](../context/build-plan.md) and [tracker](../context/progress-tracker.md). Old prompts requesting initial scaffolding, an Education API, mandatory onboarding, fictional sample resumes or first scoring/PDF implementation are superseded.

## Bounded continuation prompt

```text
Work in the fixes branch of the existing frontend worktree. Inspect status/diff and the current task owner before editing. Preserve existing changes and primary runtime configuration.

Choose one authorized incomplete item from docs/implementation-audit.md, resolve only its blocking decisions, implement and verify that slice. Explain which implemented modules you will reuse. Do not activate gated generator, JD-history or shared-workspace routes by removing allowlists.

Keep profile and resume-local edits separate. Scope AI to visible supported facts, require review and exact-version Apply, exclude protected contacts and never invent achievements. Keep decorative UI separate from paper/PDF. Use canonical permissions, scoped queries and atomic sanitized audit.

Run relevant checks and update the affected contract plus context/progress-tracker.md with actual results and limitations. Do not repeat dated browser/provider tests as fresh evidence. Give manual verification steps for changed behavior. No push/deploy or external messages without authorization.
```

## Next candidates

1. Repair contact action/event checks and legacy fabricated-metric/client-content paths before expanding API exposure.
2. Validate varied imports, exported pages and scoring against a synthetic cross-domain corpus.
3. Add durable jobs/proposal provenance and retention before full generation or shared release.
4. Complete optional profile section forms and safe consented shared-workspace integration.

Detailed scope, missing pieces and source links are in the audit. LinkedIn archive import and MCP remain unbuilt. Production hosting, storage and worker infrastructure are planned.
