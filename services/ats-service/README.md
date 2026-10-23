# ATS evidence service

Private, stateless job-fit assessment using the project's existing paid Gemini configuration. Resume-service owns authentication, authorization, contact-free projection, immutable snapshots, history and audit. This service has no database access.

`POST /internal/ats/assess` accepts the shared `atsAssessmentInputSchema` and returns `atsAssessmentSchema` directly. `GET /internal/ats/health` returns configured availability, rubric and model. Both routes require `Authorization: Bearer <private service key>`. Health availability means configured, not independently verified provider billing or access.

Gemini extracts the JD's distinct required/preferred criteria and judges quoted professional evidence. The server validates exact JD/source quotes, source identity, duplicates and clear negative source contexts. The model never supplies a numeric score. The score is the rounded percentage of required criteria supported. If there are no required criteria, stated preferences supply the denominator. Uncertain criteria receive no supported credit. Empty extraction or invalid provider evidence is unavailable; there is no legacy-score fallback.

This is candidate-provided evidence coverage, not an employer ATS algorithm, PDF parseability test, truth verification, or hiring prediction. One provider evaluation can still misunderstand or omit a criterion. Review the returned requirements and evidence; a bounded synthetic corpus is not a broad quality benchmark.

## Configuration

The personal development launcher starts port `4004` on loopback. Standalone development can use:

```sh
RESUME_FORGE_LOCAL_ROOT=/absolute/path/to/ResumeForge pnpm --filter @resume-forge/ats-service dev
```

Existing private `.env`, `.local/ai-provider.env`, and `.local/auth-transport.env` are read without modification. Process environment takes precedence.

- Existing `GEMINI_API_KEY` and `GEMINI_DATA_MODE=paid` enable analysis with `gemini-3.5-flash-lite`.
- `ATS_SERVICE_KEY`, when supplied, must contain at least 32 characters. Otherwise the service derives a separate HMAC-SHA256 credential from `LOCAL_PROFILE_SERVICE_KEY` with context `ats-service-v1`.
- `ATS_SERVICE_HOST` defaults to `127.0.0.1`; explicit container binding is supported.
- `ATS_SERVICE_PORT` defaults to `4004`.
- `ATS_SERVICE_TIMEOUT_MS` defaults to `45000` and may not exceed `60000`.

At most two requests run concurrently; excess work receives `503`. Request bodies are capped at 384,000 bytes. The shared input limits JD text to 12,000 characters and 60 unique sources totaling 60,000 professional characters. Provider output is capped at 196,608 bytes and 8,192 tokens. No automatic retry or fallback is made. Logs and errors omit private input, provider responses and credentials.

## Verification

```sh
pnpm --filter @resume-forge/ats-service... build
pnpm --filter @resume-forge/ats-service lint
pnpm --filter @resume-forge/ats-service test
```

Tests use fictional professional facts and mocked provider transport. They cover semantic evidence contracts, nontechnical criteria, synonyms/alternatives, negation, duplicates, privacy boundaries, authentication, size/concurrency bounds, timeouts and provider failures. They make no real provider requests.
