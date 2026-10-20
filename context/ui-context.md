# UI direction

Forge Studio's current app uses Sora headings and DM Sans body text, shared shadcn-style controls, Performative UI adapters, Tiptap and independent printable templates.

| Theme | Existing tokens                                                             |
| ----- | --------------------------------------------------------------------------- |
| Dark  | Carbon #111014, panel #1b1921, text #f8f6fd, violet #b89aff, border #393341 |
| Light | Mist #f5f3f8, white #ffffff, ink #271f35, violet #6631c2, border #ded7e8    |

Source: [shared stylesheet](../packages/shared/src/styles/styles.css). Device theme is the default unless explicitly overridden. The sign-in ASCII scene is full-screen; signed-in users enter My resumes. Paper remains white in either app theme.

The approved tailoring UI is described in [PLAN.md](../PLAN.md#approved-ui-direction). Keep one Tailor to a job entry point, real staged progress, evidence-linked gaps, original/proposed wording and a preview. Use shared Prompt/AssessmentMeter/dialog/button adapters. A single coherent comparison workspace is preferable to repeated glowing score cards.

Navigation/page requests share Loading your workspace…; task-specific saving/analysis messages retain their actual meaning. Status text is independent from decoration. Use visible focus, full-text comparisons, keyboard navigation, mobile sheets, reduced motion and static/offscreen decorative fallbacks. No fake percentages or hidden automatic Apply.

The initial page uses an inline resume blueprint, an AI node and a coordinated scan in the existing violet palette. **Your story, taking shape.** is product copy; **Loading your workspace…** is the real status. The screen spans session/federation startup and disappears immediately when the main page or recovery UI is ready. It does not suggest that a visitor's resume is being processed before sign-in. Light/dark themes, reduced motion, hidden-tab pause and a slow-load reload link are supported. [Implementation and verification](../docs/cold-start-loading.md#resume-system-loading-design--2026-10-15).

The user approved the three-phase UX on 2026-10-20: **Job description, Review changes, Saved copy**. Keep direct tailoring entry points, optional collapsed questions, inline entry-local fact confirmation and real processing feedback. Keep the saved resume beside job input and review on desktop, with independent pane scrolling and fixed footer actions. Phone/tablet users can switch to Preview during input as well as review. Review one suggestion at a time with shared Previous/Next and Select controls; keep every choice while navigating. Full original/suggested text and individual rejection remain available before copy-save. Save-copy/export is one user action; failed export retries without another copy or AI run. The current theme and shared Performative adapters remain. [UI behavior and verification](../docs/ux-ui-improvements.md).

Desktop uses section navigation, the document and a feedback panel. Narrow screens show Resume or Feedback/tools; readable editing reflows while Preview preserves A4 layout. Display-only mobile typography never changes saved appearance/PDF settings. Prioritized feedback reuses existing checks/weights and preserves the full detailed list and dismissal semantics. Import review is full-page and explicitly unsaved until confirmation.
