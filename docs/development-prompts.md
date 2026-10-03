# Development starter prompts

Use these in the resume-forge project. Current status is controlled by [the tracker](../context/progress-tracker.md), with the [CareerZenith builder review](careerzenith-builder-review.md) as interaction evidence. These prompts request future work; they do not mark that work implemented.

## First frontend change

```text
Prioritize the resume-forge frontend before adding more backend features.

First inspect git status/diff, the current progress tracker and the CareerZenith builder review. Use the frontend-design skill and follow AGENTS.md, F08 and the resume-editing contract. Preserve completed work.

Implement the first bounded manual-editor slice: a compact editor workspace with a section panel beside a clean resume page, synchronized manual summary editing using Tiptap, and Editor/Preview modes. Make manual editing the default; keep AI assistance contextual. Provide honest local draft state, Save/Cancel and undo/redo for the supported edits. Use one original readable template and our existing architecture/design tokens.

Define the narrow draft/render contract and record this frontend-first slice in the tracker before implementation. No AI or JD should be required. Do not imply server persistence, PDF export, scoring or full template customization before they exist. Preserve contact privacy and authentication.

Implement and verify the slice in the browser on desktop and mobile, including keyboard controls, focus and reduced motion. Run relevant checks, update the tracker with actual results and tell me what to check manually. Ask only for information that blocks this slice.
```

## Continue frontend, then return to backend

```text
Resume from the current working tree and progress tracker. Inspect the last changes and continue only unfinished work.

Keep the interactive frontend as the priority. Choose one next unblocked frontend slice from the builder review and F08 acceptance criteria: structured sections/entries, add/remove/reorder with keyboard alternatives, or draft recovery and document layout. State the exact slice, implement it and verify it. Resolve any required F20 contract/allocation before bringing appearance controls forward; do not silently activate the full proposed phase.

Once the agreed manual-builder frontend is verified, return to the next unblocked backend dependency in the tracker, including owned profile creation/onboarding drafts and durable resume persistence as applicable. Use local PostgreSQL. Keep LinkedIn on hold until credentials/configuration exist. Integrate AI only after its provider/model credentials and content contracts are settled.

Preserve completed UI, authentication, authorization and audit work. Run relevant tests and browser checks, update the tracker, and report completed work, pending work, issues, manual verification steps and a short suggested commit message. Ask only for missing information that blocks the current slice.
```
