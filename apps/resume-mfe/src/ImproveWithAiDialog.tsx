import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button, Dialog } from "@resume-forge/shared";
import {
  targetLabel,
  type DraftTarget,
  type ResumeDraft,
} from "./editor-draft";
import {
  createLocalAiPreview,
  type LocalAiPreview,
  type PreviewChange,
} from "./editor-ai-preview";
import "./improve-with-ai.css";

function TextChange({ change }: { change: PreviewChange }) {
  const before = change.original.split(/(\s+)/);
  const after = change.proposed.split(/(\s+)/);
  let start = 0;
  while (start < before.length && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - end - 1] === after[after.length - end - 1]
  )
    end++;
  const removed = before.slice(start, before.length - end).join("");
  const added = after.slice(start, after.length - end).join("");
  return (
    <section className="rf-ai-change">
      <h3>{change.label}</h3>
      <p>
        {before.slice(0, start).join("")}
        {removed ? (
          <del>
            <span className="sr-only">Removed: </span>
            {removed}
          </del>
        ) : null}
        {removed && added ? " " : null}
        {added ? (
          <ins>
            <span className="sr-only">Added: </span>
            {added}
          </ins>
        ) : null}
        {end ? before.slice(before.length - end).join("") : ""}
      </p>
      <details>
        <summary>Read original and suggested text</summary>
        <h4>Original</h4>
        <p>{change.original}</p>
        <h4>Suggested</h4>
        <p>{change.proposed}</p>
      </details>
    </section>
  );
}

export function ImproveWithAiDialog({
  base,
  target,
  onClose,
  onAccept,
}: {
  base: ResumeDraft;
  target: DraftTarget;
  onClose: () => void;
  onAccept: (preview: LocalAiPreview) => string | undefined;
}) {
  const [stage, setStage] = useState<"request" | "thinking" | "review">(
    "request",
  );
  const [preview, setPreview] = useState<LocalAiPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (stage !== "thinking") return;
    const timer = window.setTimeout(() => {
      setPreview(createLocalAiPreview(base, target));
      setStage("review");
    }, 1400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [stage, base, target]);
  const ready = stage === "review" && !!preview?.changes.length;
  const label = targetLabel(base, target);
  const title =
    stage === "request"
      ? "Improve with AI"
      : stage === "thinking"
        ? "Thinking…"
        : ready
          ? "Suggested changes"
          : "No changes needed";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={label.length > 120 ? `${label.slice(0, 120)}…` : label}
      className={`rf-ai-dialog${stage === "thinking" ? " is-thinking" : ""}`}
      bodyClassName="rf-ai-dialog-body"
      footerClassName="rf-ai-dialog-footer"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {stage === "review" && !ready ? "Done" : "Cancel"}
          </Button>
          {stage === "request" ? (
            <Button
              onClick={(event) => {
                // Keep keyboard focus inside the dialog when the request button disappears.
                event.currentTarget
                  .closest<HTMLElement>('[role="dialog"]')
                  ?.querySelector<HTMLButtonElement>("button")
                  ?.focus();
                setStage("thinking");
              }}
            >
              <Sparkles size={16} aria-hidden="true" /> Preview suggested
              changes
            </Button>
          ) : ready ? (
            <Button
              disabled={!!error}
              onClick={() => {
                setError(onAccept(preview) ?? null);
              }}
            >
              Accept changes
            </Button>
          ) : null}
        </>
      }
    >
      <p className="rf-ai-preview-note">
        Temporary preview · AI is not connected. Changes stay in this local
        draft.
      </p>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {title}
      </div>
      {stage === "request" ? (
        <div className="rf-ai-intro">
          <Sparkles size={28} aria-hidden="true" />
          <h3>A fresh look at your wording</h3>
          <p>
            Preview a small wording change using only the text in this
            selection. Review it before accepting. Your facts and other sections
            stay intact.
          </p>
        </div>
      ) : stage === "thinking" ? (
        <div className="rf-ai-thinking" aria-busy="true">
          <Sparkles size={28} aria-hidden="true" />
          <p>Preparing a temporary wording preview for your selection.</p>
          <div className="rf-ai-thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : ready ? (
        <>
          <div className="rf-ai-diff-key" aria-label="Change legend">
            <span className="rf-ai-removed-key">Removed</span>
            <span className="rf-ai-added-key">Added</span>
            <span>Only your selected text changes</span>
          </div>
          <div className="rf-ai-comparison">
            {preview.changes.map((change, index) => (
              <TextChange key={index} change={change} />
            ))}
          </div>
          <p className="rf-ai-accept-note">
            Accept applies these changes locally. Undo restores the original.
          </p>
        </>
      ) : (
        <div className="rf-ai-empty">
          <CheckCircle2 size={32} aria-hidden="true" />
          <h3>No suggestion required</h3>
          <p>
            This temporary preview has no wording changes for this selection.
            Your text is unchanged. You can continue editing manually.
          </p>
        </div>
      )}
      {error ? (
        <p role="alert" className="rf-ai-error">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
