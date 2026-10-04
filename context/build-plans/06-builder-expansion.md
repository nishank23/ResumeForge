# Phase 6 Build Plan — Resume Builder Expansion

## Local appearance brought forward — 2026-10-04

The user explicitly requested editor tool panels. One bounded browser-only formatting preview was authorized and implemented alongside F08: the existing original layout, spacing/type controls and local checkpoints/history. [Evidence](../../docs/editor-panels-verification.md). Full Phase 6 allocation, additional template inventory, saved settings, shared presets, fit-to-page and preview/PDF rendering remain behind the entry gate below; no dependency is marked complete from local UI evidence.


**Features:** F19–F20. **State:** Not started. **Allocation:** Proposed for user review. **Goal:** Complete the observed file-intake and document-customization capabilities without disrupting the original F01–F18 sequence.

## Entry gate

Context and development authorization must be recorded; F08/F09/F10 and F14/F15 must be verified. Resolve D14 before file processing. Approve template inventory, readable bounds, retention and relevant D05/D10/D12 policies before dependent work. This phase adds real effort; it does not imply the original delivery estimate is unchanged.

## Task P6.1 — Existing-file intake (F19)

Planned areas: resume-MFE import/review screens, resume-service import use cases, private upload storage and isolated parser task.

- [ ] Implement [F19](../feature-specs/19-resume-file-import.md) with validated formats/limits, staged extraction, field review and explicit confirm.
- [ ] Enforce contact separation, provenance, no master-profile writes, idempotency and execution-time authorization.
- [ ] Verify malicious/corrupt/unsupported input, uncertain extraction, retry/cancel/revocation and retention cleanup using synthetic files.

## Task P6.2 — Templates and document settings (F20)

Planned areas: template registry/render DTOs, shared renderers, gallery/format controls, resume-version and scoped preset use cases.

- [ ] Implement [F20](../feature-specs/20-template-customization.md): original gallery, presets, margins, spacing, typography/color and reset.
- [ ] Add readable fit-to-page proposals, explicit saves and immutable render settings.
- [ ] Verify preview/PDF parity, font failure, no clipping/content loss, restricted-contact exports and workspace preset authorization.

## Integration and exit gate

- [ ] An imported and reviewed resume can be edited, scored against a supplied JD, cloned, customized and exported under current policy.
- [ ] Each row in [capability coverage](../resume-capability-coverage.md) has implementation evidence or an explicit unresolved decision; an observed competitor control alone never counts as a passed test.
- [ ] F19/F20 acceptance passes and the tracker records actual commands/results/limitations.

Cover letters, billing, jobs and hiring workflows are not introduced. MCP stays at seven tools; imports and formatting are REST/UI operations unless separately scoped. Visual concepts remain paused until the user resumes them.
