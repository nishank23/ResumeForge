# CareerZenith ATS workflow comparison

## Supplied no-JD screenshots and new rule cards — 2026-10-09

The latest user-supplied screenshots show one pending bullet-volume rule and initially passing rule families for bold restraint, entry technologies/context, education detail, supported skill count, contacts and section presence. No new reference login/upload was performed for this comparison. These images establish visible capabilities only; they do not reveal score weights or rating thresholds.

ResumeForge now provides compact no-JD rule cards, current exact-entry Fix/View, Reason and persisted Dismiss/Restore. Completed requires every instance of a family to pass; initial passes qualify. Additional reference-inspired guidance is explicitly score-neutral, retaining the approved scoring math. Contact guidance uses presence only on the private owner document. shadcn-based controls/Tiptap are the editor foundation; no Performative decoration is added. This supersedes the earlier statement that contact-presence guidance was wholly pending, but does not implement exported-PDF parsing checks, font-size scoring, copied score thresholds or the reference's private algorithm. [Current contract](ats-workflow.md#no-jd-rule-guidance-and-compatibility--2026-10-09).


## Authenticated Chrome inspection — 2026-10-09

The user explicitly requested their signed-in Google Chrome session. A separate research tab reused that existing session; no login, OAuth consent, upload or credential action was needed. This resolves the earlier anonymous-browser access blocker. Observations below concern visible behavior, not the private scoring implementation.

| Case | Observed initial result | Visible behavior |
| --- | --- | --- |
| Existing owned copy | 73%, Good; Pending 1, Completed 22, Deleted 0 | Opens ATS Score directly, without a JD or a Run action. Pending feedback concerns quantified achievements. |
| New blank template | 10%, Poor; Pending 3, Completed 3, Deleted 0 | Scores automatically. Pending checks concern incomplete education, skill count and contact completeness. Presence checks for work/projects, skills and education already appear in Completed. |
| Synthetic education edit | 13%, Poor; Pending 2, Completed 4 | Fix opens Education #1 with its issue reason and Go to field. Guidance updates while typing. A saved synthetic degree/institution and one year move the education check into Completed. Reload retains the result. |

The synthetic reference record is named **ATS Review (Synthetic)** and remains in the reference account. It contains synthetic education text and no contacts. It was not deleted. Existing resume content was only inspected; opening can update reference metadata. No real facts were entered, changed, uploaded, downloaded or copied into repository fixtures. The synthetic test used a start year without an end year; it does not establish the reference's date-validation rules.

Completed in the existing case lists checks spanning headings/empty sections, experience and project detail, skills, dates/current status, links/portfolio, contact presence, document length, font size and bold usage. This proves that initially satisfied checks belong in Completed. It does not establish each rule's full condition, weight, data source or reliability. Reason controls were visible, but their hover tooltip behavior was not verified. Reference dismissal, AI Fix, export, JD matching, score thresholds and provider calls were not exercised.

Contact-free existing-panel screenshot: `/private/tmp/careerzenith-existing-ats.png`. Synthetic reference screenshot after save/reload: `/private/tmp/careerzenith-synthetic-ats.png`. These local artifacts are not repository fixtures.

## Implemented interaction equivalents in ResumeForge

- The saved editor opens ATS Score; missing/outdated saved assessments run automatically. Recheck and visible failure retry remain available.
- Completed contains all currently passing checks. Pending and Deleted contain failed checks split by the existing persisted dismissal preference; dismissal never raises the score.
- Reason expands accessibly. Fix opens the stable target's manual dialog with contextual guidance and Go to field. Global rules open Edit Content with guidance.
- Manual edit candidates and local draft changes show an explicitly unsaved preview, using the same pure professional projection and scorer as the service. Cancel restores the previous draft. Content saving remains explicit; successful saves trigger a version-bound assessment while ATS Score is visible (otherwise it checks on reopening).
- Assessment history, expected-version checks, authorization, contact exclusion and the user-approved 25/25/20/15/15 rubric remain intact. No provider, credential, schema, role or master-profile change is introduced.

This is interaction parity for general readiness, not an exact CareerZenith score clone. Our empty input scores 0 rather than awarding points to unpopulated template sections. Our rubric allows supported projects in place of paid employment and optional metrics. Contact, appearance and URL checks need their own reviewed contracts rather than importing reference assumptions. Hidden scoring weights, grade thresholds, employer ATS compatibility, semantic JD matching and AI behavior remain unverified/unimplemented here.

## Historical access attempt

The earlier anonymous in-app-browser inspection stopped at sign-in; automatic approval review rejected Continue with Google because that specific sign-in was not authorized in that request. No login was completed. The current explicit Chrome request reused the existing authenticated session and required no rejected action or workaround.
