import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Dialog } from "@resume-forge/shared";
import type {
  RewriteProposal,
  RewriteTarget,
} from "@resume-forge/shared-types";
import {
  richTextPlain,
  sectionFor,
  targetLabel,
  type ResumeDraft,
  type DraftTarget,
} from "./editor-draft";
import "./improve-with-ai.css";
import { RewriteTextChange } from "./RewriteTextChange";
export interface RewriteServices {
  request: (target: RewriteTarget) => Promise<RewriteProposal>;
  apply: (proposal: RewriteProposal) => Promise<ResumeDraft>;
}
export function rewriteTarget(
  draft: ResumeDraft,
  target: DraftTarget,
): RewriteTarget | undefined {
  const section = sectionFor(draft, target);
  if (!section || section.hidden) return;
  if (target.type === "section" && section.kind === "summary") return target;
  if (["experience", "projects"].includes(section.kind)) {
    if (target.type === "entry") return target;
    if (target.type === "bullet")
      return {
        type: "entry",
        sectionId: target.sectionId,
        itemId: target.entryId,
      };
  }
}
export function ServerRewriteDialog({
  base,
  target,
  services,
  disabledReason,
  onClose,
  onApplied,
}: {
  base: ResumeDraft;
  target: RewriteTarget;
  services?: RewriteServices;
  disabledReason?: string;
  onClose: () => void;
  onApplied: (draft: ResumeDraft) => void;
}) {
  const [busy, setBusy] = useState(false),
    [applying, setApplying] = useState(false),
    [proposal, setProposal] = useState<RewriteProposal | null>(null),
    [error, setError] = useState("");
  const submitted = useRef(false),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const section = base.sections.find((s) => s.id === target.sectionId),
    entry =
      target.type === "entry"
        ? section?.entries.find((e) => e.id === target.itemId)
        : undefined;
  const original = entry
    ? [
        richTextPlain(entry.description),
        ...entry.bullets.filter((b) => !b.hidden).map((b) => b.text),
      ].filter(Boolean)
    : section
      ? [richTextPlain(section.summary)].filter(Boolean)
      : [];
  const close = () => {
    live.current = false;
    onClose();
  };
  const request = async () => {
    if (submitted.current || !services) return;
    submitted.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await services.request(target);
      if (live.current) setProposal(result);
    } catch (e) {
      if (live.current)
        setError(e instanceof Error ? e.message : "AI request failed. Retry.");
    } finally {
      if (live.current) {
        submitted.current = false;
        setBusy(false);
      }
    }
  };
  const apply = async () => {
    if (submitted.current || !proposal || !services) return;
    submitted.current = true;
    setApplying(true);
    setError("");
    try {
      const draft = await services.apply(proposal);
      if (live.current) onApplied(draft);
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not save the suggestion. Retry.",
        );
    } finally {
      if (live.current) {
        submitted.current = false;
        setApplying(false);
      }
    }
  };
  return (
    <Dialog
      open
      title={
        busy
          ? "Reviewing your wording…"
          : proposal
            ? proposal.changes.length
              ? "Suggested changes"
              : "No changes needed"
            : "Improve this description"
      }
      description={targetLabel(base, target)}
      onOpenChange={(open) => {
        if (!open && !applying) close();
      }}
      className="rf-ai-dialog"
      bodyClassName="rf-ai-dialog-body"
      footerClassName="rf-ai-dialog-footer"
      footer={
        <>
          <Button variant="outline" disabled={applying} onClick={close}>
            {proposal && !proposal.changes.length ? "Done" : "Cancel"}
          </Button>
          {proposal?.changes.length ? (
            <Button
              disabled={busy || applying || !!disabledReason}
              aria-busy={applying}
              onClick={() => void apply()}
            >
              {applying ? "Saving…" : "Apply and save version"}
            </Button>
          ) : !proposal ? (
            <Button
              disabled={busy || !!disabledReason || !original.length}
              aria-busy={busy}
              onClick={() => void request()}
            >
              <Sparkles size={16} />
              {busy ? "Reviewing…" : "Improve with AI"}
            </Button>
          ) : null}
        </>
      }
    >
      {!proposal ? (
        <>
          <h3>Current description</h3>
          <div className="rf-ai-original">
            {original.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {!original.length ? (
              <p>
                Add your real description and save first. AI cannot create
                missing experience.
              </p>
            ) : null}
          </div>
          <p>
            Gemini improves wording using your saved facts. Review every
            proposed change before saving.
          </p>
          <p className="rf-ai-scope">
            Clicking Improve with AI sends only this saved description and its
            visible achievements to Gemini. Contact fields and other entries are
            excluded.
          </p>
        </>
      ) : proposal.changes.length ? (
        <>
          <p>
            Check that each change preserves your facts. Applying saves one
            version for this selection.
          </p>
          <div className="rf-ai-diff-key" aria-label="Change legend">
            <span className="rf-ai-removed-key">Removed</span>
            <span className="rf-ai-added-key">Replacement</span>
          </div>
          <div className="rf-ai-comparison">
            {proposal.changes.map((change) => (
              <RewriteTextChange key={change.field} change={change} />
            ))}
          </div>
        </>
      ) : (
        <p role="status">
          No supported wording changes were returned. Your resume remains
          unchanged.
        </p>
      )}
      {disabledReason ? <p role="status">{disabledReason}</p> : null}
      {error ? (
        <p role="alert" className="rf-ai-error">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
