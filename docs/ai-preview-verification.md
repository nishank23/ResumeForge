# Temporary AI improvement dialogs — 2026-10-04

The user requested frontend-only dialogs after Improve with AI, matching the supplied thinking and suggested-change references, plus a no-suggestion state. Work is on `codex/frontend`; backend services, public contracts, schema and dependencies are unchanged. Read root/context guidance and branch ownership before claiming the existing local task lock.

## Local behavior

Improve with AI opens an accessible request dialog for the exact selected section, entry or achievement. **Preview suggested changes** explicitly starts a 1.4-second temporary Thinking state, followed by **Suggested changes** or **No changes needed / No suggestion required**. Every stage says AI is not connected. The small local wording examples are presentation fixtures, not a provider, assessment or grounded AI service. No percentage or quality score is shown.

The review uses red strikethrough removals, green underlined additions, a text legend and expandable original/suggested text. Accept changes commits only selected professional text into the existing local history in one step. Cancel, Close and Escape discard the preview without changing the draft; closing a pending preview clears its timer. The empty state has Done and no Accept. Missing, empty, hidden and protected targets yield no candidate changes. Skills retains its existing dialog-only behavior with no AI toolbar.

Preserve marks, rich-text structure, stable IDs, employers, titles, dates, metrics, skills, sibling entries, other sections and separate synthetic contacts. Acceptance rejects a changed draft instead of overwriting newer edits. Undo/Redo restores the accepted local change. Reload/navigation/session loss still clears all drafts and checkpoints. This flow never calls an API or stores content in browser storage.

## Design and review

Retain Forge system sans for controls and Georgia on the resume. Palette: paper `#FFFFFF`, ink `#172033`, secondary `#536079`, Forge indigo `#4338CA`, violet `#8B5CF6`, border `#D8DEEA`. Existing semantic tokens control app surfaces/text in each theme. Red/green diff surfaces also use strike/underline and labels.

```text
[ Sparkle  Title                         Close ]
[ Selected target                              ]
[ Temporary preview notice                     ]
[ Request / Thinking / Diff / No changes needed ]
[                         Cancel       Accept  ]
```

Left-aligned content, bounded violet dotted corners, scrollable body and fixed footer follow the supplied reference without changing the paper design. Mobile stacks actions and wraps long text; target labels cap at 120 characters. Dots animate only during the temporary wait; reduced-motion CSS disables them and dialog transitions. No decorative layers enter document content or export.

## Checks actually run

- `pnpm --filter @resume-forge/resume-mfe lint` — passed after removing two unnecessary conditional checks.
- `pnpm --filter @resume-forge/resume-mfe typecheck` — passed; final `build` also reran `tsc --noEmit` after focus/label corrections.
- `pnpm --filter @resume-forge/resume-mfe test` — **25/25 passed**, including five new target isolation, rich-format preservation, hidden/protected/empty targets, one-step Undo/Redo and changed-draft rejection cases.
- `pnpm --filter @resume-forge/resume-mfe build` — passed. No package or Turbo configuration changes.
- Targeted Prettier and `git diff --check` — passed.

Browser checks used the existing standalone synthetic preview at `http://localhost:3003`. Measured viewports: **1163×727 desktop**, **390×843 mobile** and **320×740 mobile**. The browser scales requested viewport values; these are actual measured CSS sizes.

Verified all four dialog states; Cancel and Escape; pending cancellation without later reopening; Accept/Undo; reviewed-target focus return; close-button and final-action Tab/Shift+Tab wrapping; no Accept in the empty state; and preserved manually typed text after preview Cancel. A long Unicode achievement with a 400-character unbroken run stayed within the 320px viewport, scrolled inside the dialog and left both 44px footer controls visible. Its just-entered text appeared in the preview after blur. Browser review found and corrected focus loss when the request action disappeared and hover-driven selection changes after closing. No horizontal page or dialog overflow was observed.

Screenshots are local temporary artifacts: `/tmp/resume-ai-suggested-changes.png`, `/tmp/resume-ai-thinking-mobile.png`, `/tmp/resume-ai-suggested-mobile.png`, `/tmp/resume-ai-no-changes-mobile.png`. They contain fictional sample content only. Viewport overrides were reset after verification.

These checks do not verify actual touch hardware, screen-reader speech, a runtime reduced-motion preference switch, dark-theme interaction, shell authentication, backend/database behavior, provider grounding, persisted versions, scoring or PDF. Those remain separate gates; F08 is still partial and E07 is not complete.

## Manual check

1. Reload the sample editor. Select Summary, then Improve with AI.
2. Choose Preview suggested changes; observe Thinking and the red/green review.
3. Cancel and confirm text is unchanged. Repeat, accept, then Undo.
4. Accept the Summary preview again, reopen it and request another preview: No changes needed appears with Done and no Accept.
5. Try a Project achievement, a section or an empty description. Check scope, cancel/focus return and long-text scrolling at narrow widths.

Next: another explicitly approved frontend slice. Real grounded suggestions require the existing provider, saved-version and policy contracts before replacing this temporary preview.
