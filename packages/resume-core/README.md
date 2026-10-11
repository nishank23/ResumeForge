# Resume core

Pure deterministic domain logic. No actor, workspace, HTTP, ORM or storage imports.

- [x] ✅ `computeReadiness` implements general no-JD **readiness-v2**: structure 25%, experience detail 25%, skills presentation 20%, achievement clarity 15%, date consistency 15%.
- [x] ✅ `readinessProjection` selects visible professional content and excludes header/contact values, source extraction, hidden content and appearance. A caller may provide the bounded contact-completeness boolean; contact values never enter the scorer.
- [x] ✅ `computeJdMatch` implements **jd-local-v1**: required keywords 30%, experience relevance 25%, skills 20%, structure 15%, readability 10%, with optional supplied evidence.
- [ ] Corpus calibration, actual PDF parseability and full profile gap workflows remain incomplete.

Each component rounds passed/total checks to 0–100; total rounds the weighted sum. Empty input scores 0. Feedback is bounded independently of scoring math. These are internal heuristics, not employer ATS algorithms or factual verification.

The service validates and authorizes the latest saved version, projects permitted inputs, resolves evidence, persists assessments and handles staleness. AI/providers/vector retrieval remain outside this package.

```sh
pnpm --filter @resume-forge/resume-core build
pnpm --filter @resume-forge/resume-core test
```

See [scoring workflow](../../docs/ats-workflow.md) and [remaining scope](../../docs/implementation-audit.md).
