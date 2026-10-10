# ATS provider boundary — 2026-10-09

## Active provider

The user now selects paid Gemini for semantic JD evidence and selected wording. The central boundary is `services/resume-service/src/ats/ai.ts`, injected into the authenticated/versioned use cases. It uses **gemini-3.5-flash-lite** for both text operations and **gemini-embedding-001** at 768 dimensions for private retrieval. No Gemini SDK is needed: the existing bounded server REST transport validates structured JSON, source quotes and stable IDs.

Numeric readiness/JD results remain our approved fixed backend heuristics. AI provides responsibility correspondence for experience/projects and separately proposes wording changes; it does not invent scores, skills, metrics or qualifications. User consent precedes provider calls and review precedes versioned Apply. [Full contract, current official sources and limits](ats-workflow.md).

## Removed providers and compatibility

The corporate-email Textkernel plan was cancelled. Its unused configuration, prepared-reference runtime and vendor adapter/tests are removed; no app route consumed them. The legacy public `jd-match-v1` schema remains for compatibility. No account/indexing/signup action is planned.

OpenCode SDK/native session/HTTP adapters and dependency are removed after the user chose Gemini. Existing global CLI installations/credentials are outside this project cleanup. Stored MiMo proposals remain schema-readable, while every new proposal records the active Gemini model. Both assessment replay checks compare model identity; the former Gemini 3.8 Flash assessment remains historical and cannot suppress a new model result.

## Setup and checks

Configure `GEMINI_API_KEY` in the original ignored `.env` and `GEMINI_DATA_MODE=paid` in ignored `.local/ai-provider.env`. Do not expose keys through browser environment values. Real professional text requires the approved paid data mode and per-request consent. No OpenCode/Textkernel credentials are needed by the application.

Use [README manual checks](../README.md#setup-and-manual-checks) for ATS areas, JD analysis, targeted Fix and Gemini review/Apply/reload. [Tracker](../context/progress-tracker.md) records actual tests and remaining limits. Broader parser vocabulary, calibrated cross-domain evaluation, durable jobs and production cost controls remain incomplete.
