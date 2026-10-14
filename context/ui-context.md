# UI direction

Forge Studio's current app uses Sora headings and DM Sans body text, shared shadcn-style controls, Performative UI adapters, Tiptap and independent printable templates.

| Theme | Existing tokens |
| --- | --- |
| Dark | Carbon #111014, panel #1b1921, text #f8f6fd, violet #b89aff, border #393341 |
| Light | Mist #f5f3f8, white #ffffff, ink #271f35, violet #6631c2, border #ded7e8 |

Source: [shared stylesheet](../packages/shared/src/styles/styles.css). Device theme is the default unless explicitly overridden. The sign-in ASCII scene is full-screen; signed-in users enter My resumes. Paper remains white in either app theme.

The approved tailoring UI is described in [PLAN.md](../PLAN.md#approved-ui-direction). Keep one Tailor to a job entry point, real staged progress, evidence-linked gaps, original/proposed wording and a preview. Use shared Prompt/AssessmentMeter/dialog/button adapters. A single coherent comparison workspace is preferable to repeated glowing score cards.

Navigation/page requests share Loading your workspace…; task-specific saving/analysis messages retain their actual meaning. Status text is independent from decoration. Use visible focus, full-text comparisons, keyboard navigation, mobile sheets, reduced motion and static/offscreen decorative fallbacks. No fake percentages or hidden automatic Apply.

The user approved the first tailoring slice. Its evidence/review/export dialog is connected using the current theme, not a new color redesign. [Contract and manual checks](../docs/full-resume-tailoring.md).
