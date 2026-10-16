# Current implementation audit

Updated 2026-10-16, starting baseline cd08f37. The first full-tailoring slice is implemented on feature; [progress](../context/progress-tracker.md) records current verification. [PLAN.md](../PLAN.md) distinguishes delivered scope from later phases.

## Implemented bounded capabilities

| Capability | Source evidence | Remaining scope |
| --- | --- | --- |
| ✅ Google identity/personal sessions | [Auth app](../services/auth-service/src/app.ts), [shell](../apps/shell/src/App.tsx) | LinkedIn linking, production/distributed sessions. |
| ✅ Saved personal resume lifecycle | [Use cases](../services/resume-service/src/resume.ts), [library](../apps/resume-mfe/src/ResumeLibrary.tsx) | Connected clone/history/restore-as-new-version, global search/sort and retention. Backend legacy handlers alone do not complete those flows. |
| ✅ Reviewed resume import | [Upload](../services/resume-service/src/upload.ts), [import dialog](../apps/resume-mfe/src/ResumeImportDialog.tsx) | OCR/legacy DOC/arbitrary-layout accuracy and explicit master-profile import/provenance. |
| ✅ Structured editing/styles/PDF | [Editor](../apps/resume-mfe/src/ManualResumeEditor.tsx), [registry](../apps/resume-mfe/src/templates/registry.ts), [PDF](../services/resume-service/src/pdf.ts) | Readable pagination, render/Unicode parity, DOCX output, artifact retention and actual extracted-file checks. |
| ✅ Readiness/JD matching | [Core JD scoring](../packages/resume-core/src/jd-scoring.ts), [ATS use cases](../services/resume-service/src/ats/use-cases.ts) | Seniority/years evidence, full master-versus-resume gap UX, cross-domain calibration. Current numeric weights remain fixed. |
| ✅ Scoped paid Gemini proposals and full saved-source tailoring | [AI adapter](../services/resume-service/src/ats/ai.ts), [tailoring use cases](../services/resume-service/src/tailoring/use-cases.ts), [review](../apps/resume-mfe/src/TailoringDialog.tsx) | Reviewed experience answers are connected; master facts, cross-role quality calibration, dedicated distributed orchestration and commercial usage/cost ledgers. |
| ✅ Private semantic retrieval | [Vector contract](resume-vector-search.md), [schema](../packages/prisma-client/prisma/schema.prisma) | Background invalidation/indexing and policy-safe broader retrieval. Not a cross-candidate HR search. |
| ✅ Forge Studio/shared loaders and tailoring stages | [Shared exports](../packages/shared/src/index.ts), [review](../apps/resume-mfe/src/TailoringDialog.tsx), [pre-JavaScript cold-visit fix](cold-start-loading.md) | Broad assistive-technology/low-end audits remain release checks. |
| ✅ Local full-app Docker/audit transport | [Compose](../compose.yaml), [Docker contract](docker-setup.md), [audit delivery](../packages/prisma-client/src/audit-delivery.ts) | Public hosted identity, backup/restore, retention, supervised operations. Docker is local/demo packaging. |

## Priority findings in existing source

- Optional basic profile form and professional section CRUD exist in [profile service](../services/profile-service/src/profile.ts) and [profile remote](../apps/profile-mfe/src/ProfileRemoteRoot.tsx). Full section/contact forms, reorder and explicit master import/export are missing. Contact permission/event defects require repair before broader integration.
- Generation, legacy suggestions/Apply, clone, version browsing, JD history and gap handlers exist in [resume use cases](../services/resume-service/src/resume.ts). [Personal runtime allowlist](../services/resume-service/src/app.ts) and gateway do not expose these wholesale. Legacy tailor computes scores; it is not AI full-resume tailoring.
- Legacy quantify now retains text instead of fabricating 35%. Other [legacy suggestions](../services/resume-service/src/suggestion-engine.ts) and [client-authored Apply](../services/resume-service/src/generator-contracts.ts) remain gated. New full tailoring uses Gemini 3.8 Flash whole-source writing, independent fact/coverage review, bounded correction, stored validated proposals and atomic copy/version/audit save.
- [Workspace business handlers](../services/workspace-service/src/workspace.ts) and [policy](../packages/access-policy/src/index.ts) exist, but organization/vendor UI, invitation acceptance/consent, contact/output permissions, safe shared startup and complete audit coverage are unfinished. Preserve 27 permissions; cover-letter permissions remain reserved.
- TaskRun/JDHistory/ResumeVersion/ResumeSearchChunk exist in [Prisma](../packages/prisma-client/prisma/schema.prisma). Table presence is not durable job orchestration or full provenance.

## Not implemented

URL JD fetching, reviewed master importer/exporter, DOCX output, actual exported-file ATS compatibility, JobApplication/Kanban, subscriptions/UsageLedger/checkout, CoverLetter/recruiter-message product flow, LinkedIn archive merge, production artifact storage and MCP integration.

## Vendor proposal assessment

The schema has Vendor and WorkspaceType.vendor, but no VendorCandidate or ClientSubmission model. Current vector retrieval filters to one owned resume/version; it cannot rank a vendor bench. Parsing and owner-PDF workers already enforce bounded concurrency, size/time and memory limits, so reuse those seams before introducing bulk scheduling.

Personal audit capture/relay and conflicting-payload hashes exist. The current ingestion boundary rejects non-individual workspaces; a payload hash is not an independently verifiable tamper-evident chain. Vendor submission/export/link access events, privacy variants, consent, restricted rates, secure expiring/revocable links and private R2 artifact lifecycle still need design and verification. [Proposed order](../PLAN.md#proposed-vendor-extension) starts with personal quality and shared authorization.

## Next work

Guided, confirmed experience answers now supplement saved facts without changing the source or master. The worksheet now selects at most three relevant optional questions across the resume, presents them one at a time and preserves earlier context/detail answers. Initial writing uses low thinking while independent review/correction retain medium. New queued runs refresh the existing session grant before submission; expiry checks remain in force. Rechecking a JD after a saved run no longer resets navigation to Export. Fresh local checks are recorded in the tracker. Fix import project boundaries and repeated description/achievement wording, then calibrate JD extraction/tailoring across a synthetic role corpus before adding reviewed master intake and export compatibility. [First-slice contract and checks](full-resume-tailoring.md). Add later roadmap phases at their dependent boundaries; no new provider, weights or shared access is approved by source existence.

The previous detailed numbered audit/document inventory is [archived](archive/2026-10-14/docs/implementation-audit.md). Setup stays in README; dated evidence stays in the archive.
