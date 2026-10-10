# Resume core

Pure deterministic domain logic. No workspace, actor, HTTP, ORM or storage imports.

`computeReadiness(ReadinessInput)` calculates general no-JD `readiness-v1`: structure 25%, experience detail 25%, skills presentation 20%, achievement clarity 15%, date consistency 15%. Each component rounds passed/total checks to 0–100; total rounds the weighted sum. Empty professional input scores 0. Output includes component counts and at most 100 generic rule outcomes/targets; `truncated` does not change score math.

The calling service must validate input, authorize the owner/current saved version, and project visible professional fields. `readinessProjection(ReadinessDocument)` accepts a structural professional document view and excludes header/contacts, source extraction text, hidden content and appearance. Both browser draft previews and the saved-version service use this function; no ORM/storage model enters the core. The service remains responsible for authorization and validation. Word length, presence, duplicate skills and date ordering are heuristics, not factual verification, semantic matching, PDF parseability or an employer ATS score. Metrics are optional.

Build and test: `pnpm --filter @resume-forge/resume-core build` then `pnpm --filter @resume-forge/resume-core test`. Synthetic fixtures cover math, empty/strong content, keyword stuffing, dates, optional metrics, early-career projects, stable rules and feedback truncation. See the root README for manual checks and service retention/version limits.
