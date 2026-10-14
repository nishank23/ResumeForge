import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dialog,
  RequestFeedback,
  StudioPrompt,
} from "@resume-forge/shared";
import {
  applyTailoringPreview,
  type TailoringState,
} from "@resume-forge/shared-types";
import type { SavedResume } from "./resume-api";
import type { ResumeDraft } from "./editor-draft";
import { RewriteTextChange } from "./RewriteTextChange";
import { ResumePage } from "./ResumePage";
import { ResumeDocument } from "./ResumeDocument";
import { appearanceVariables, DEFAULT_APPEARANCE } from "./editor-appearance";
import "./improve-with-ai.css";
import "./tailoring.css";

export interface TailoringServices {
  load: (signal?: AbortSignal) => Promise<TailoringState>;
  start: (id: string, text: string) => Promise<TailoringState>;
  cancel: (id: string) => Promise<TailoringState>;
  apply: (
    id: string,
    selected: string[],
    title: string,
  ) => Promise<SavedResume>;
  openCopy: (id: string) => void;
}
const noop = () => {};
export function TailoringDialog({
  base,
  savedVersion,
  initialJd,
  services,
  disabledReason,
  reducedMotion,
  onClose,
}: {
  base: ResumeDraft;
  savedVersion: number;
  initialJd: string;
  services: TailoringServices;
  disabledReason?: string;
  reducedMotion?: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<TailoringState | null>(null),
    [text, setText] = useState(initialJd),
    [selected, setSelected] = useState<string[]>([]),
    [title, setTitle] = useState(`${base.title} · tailored`.slice(0, 200)),
    [step, setStep] = useState<"job" | "evidence" | "review" | "export">("job"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copyId, setCopyId] = useState<string | null>(null);
  const live = useRef(true),
    submitted = useRef(false),
    initializedRun = useRef(""),
    initializedChoices = useRef(""),
    requestId = useRef<string | null>(null);
  const run = state?.run,
    running = run?.status === "queued" || run?.status === "drafting";
  const stale =
    !!run &&
    run.status !== "saved" &&
    (run.sourceVersion !== savedVersion ||
      Date.now() > Date.parse(run.expiresAt));
  const blocked = busy || !!disabledReason || stale;
  const acceptState = useCallback((next: TailoringState) => {
    setState(next);
    if (next.run?.id !== initializedRun.current && next.run) {
      initializedRun.current = next.run.id;
      setText(next.run.jdText);
      setCopyId(next.run.copyId);
    }
    if (next.run?.status === "saved") {
      setCopyId(next.run.copyId);
      setStep("export");
    }
    if (
      next.run?.status === "ready" &&
      initializedChoices.current !== next.run.id
    ) {
      initializedChoices.current = next.run.id;
      setSelected(next.run.changes.map((c) => c.id));
      setStep("review");
    }
  }, []);
  useEffect(() => {
    live.current = true;
    const abort = new AbortController();
    void services
      .load(abort.signal)
      .then((next) => {
        if (!abort.signal.aborted) acceptState(next);
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not load tailoring.",
          );
      });
    return () => {
      live.current = false;
      abort.abort();
    };
  }, [services, acceptState]);
  useEffect(() => {
    if (!running) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    const poll = async () => {
      try {
        const next = await services.load(abort.signal);
        if (!stopped) {
          acceptState(next);
          setError("");
        }
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Could not refresh progress. Reopen this dialog to retry.",
          );
      }
      if (!stopped) timer = setTimeout(() => void poll(), 2000);
    };
    timer = setTimeout(() => void poll(), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      abort.abort();
    };
  }, [services, running, acceptState]);
  const preview = useMemo(() => {
    if (!run || stale || run.status !== "ready") return base;
    return applyTailoringPreview(base, run.changes, selected);
  }, [base, run, selected, stale]);
  const mutate = async (operation: () => Promise<TailoringState | null>) => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await operation();
      if (live.current && next) acceptState(next);
    } catch (e) {
      if (live.current)
        setError(e instanceof Error ? e.message : "Tailoring failed. Retry.");
    } finally {
      if (live.current) {
        submitted.current = false;
        setBusy(false);
      }
    }
  };
  const start = () => {
    if (
      running ||
      busy ||
      disabledReason ||
      !state?.available ||
      text.trim().length < 50 ||
      text.length > 12000
    )
      return;
    const id = requestId.current ?? crypto.randomUUID();
    requestId.current = id;
    void mutate(async () => {
      const next = await services.start(id, text);
      requestId.current = null;
      setStep("evidence");
      return next;
    });
  };
  const save = () => {
    if (!run || run.status !== "ready" || blocked) return;
    void mutate(async () => {
      const copy = await services.apply(run.id, selected, title);
      if (live.current) {
        setCopyId(copy.id);
        setStep("export");
        setState((previous) =>
          previous?.run
            ? {
                ...previous,
                run: { ...previous.run, status: "saved", copyId: copy.id },
              }
            : previous,
        );
      }
      return null;
    });
  };
  return (
    <Dialog
      open
      title="Tailor your resume"
      description={`${base.title} · saved version ${String(savedVersion)}`}
      className="rf-ai-dialog rf-tailoring-dialog"
      bodyClassName="rf-ai-dialog-body"
      footerClassName="rf-ai-dialog-footer"
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Close
          </Button>
          {running ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void mutate(() => services.cancel(run.id))}
            >
              Cancel tailoring
            </Button>
          ) : null}
          {step === "review" && run?.status === "ready" ? (
            <Button disabled={blocked || !title.trim()} onClick={save}>
              {busy ? "Saving…" : "Save tailored resume"}
            </Button>
          ) : null}
          {copyId ? (
            <Button
              onClick={() => {
                services.openCopy(copyId);
              }}
            >
              Open tailored resume
            </Button>
          ) : null}
        </>
      }
    >
      <nav className="rf-tailoring-stages" aria-label="Tailoring stages">
        {(["job", "evidence", "review", "export"] as const).map((s, i) => (
          <button
            key={s}
            aria-current={step === s ? "step" : undefined}
            disabled={
              busy ||
              (s === "evidence" && !run) ||
              (s === "review" && run?.status !== "ready") ||
              (s === "export" && !copyId)
            }
            onClick={() => {
              setStep(s);
            }}
          >
            <span aria-hidden="true">{i + 1}</span>
            {s === "job"
              ? "Job description"
              : s === "evidence"
                ? "Evidence"
                : s === "review"
                  ? "Review"
                  : "Export"}
          </button>
        ))}
      </nav>
      {disabledReason ? <p role="status">{disabledReason}</p> : null}
      {stale ? (
        <p role="status">
          Source version changed or suggestions expired. Start a fresh request
          from the Job description stage.
        </p>
      ) : null}
      {error || run?.error ? (
        <p role="alert" className="rf-ai-error">
          {error || run?.error}
        </p>
      ) : null}
      {running ? (
        <div className="rf-tailoring-progress" role="status">
          <RequestFeedback
            label={
              run.status === "queued"
                ? "Tailoring queued"
                : run.promptVersion === "tailor-v2" &&
                    [1, 3].includes(run.batchesDone)
                  ? "Checking facts and source coverage"
                  : run.batchesDone === 2
                    ? "Refining wording after fact review"
                    : "Writing your role-targeted resume"
            }
            reducedMotion={reducedMotion}
          />
          <p>
            {run.batchesDone} of {run.batchesTotal} stages complete. You can
            close this dialog and reopen it to check progress.
          </p>
        </div>
      ) : null}
      {step === "job" ? (
        <>
          <h3>Start with the role you want</h3>
          <p>
            Use this saved resume as your fact source. Your original resume and
            master profile stay unchanged.
          </p>
          <StudioPrompt
            label="Target job description"
            value={text}
            onChange={(v) => {
              setText(v);
              requestId.current = null;
            }}
            placeholder="Paste the role, responsibilities and required skills"
            disabled={busy || running}
            submitLabel={
              run?.status === "failed" || stale
                ? "Retry tailoring with Gemini"
                : "Create full-resume suggestions"
            }
            submitSparkle
            submitDisabled={
              busy ||
              running ||
              !!disabledReason ||
              !state?.available ||
              text.trim().length < 50 ||
              text.length > 12000
            }
            onSubmit={start}
          />
          <p className="rf-ai-scope">
            Create suggestions sends visible professional descriptions,
            achievements, role titles, listed skills/tools and job requirements
            to Gemini 3.8 Flash. Identity, contacts, dates, hidden content and
            source files are excluded. Review every proposal before saving.
          </p>
          <p className="rf-tool-hint">
            Use your complete uploaded CV as the source. Add missing real
            responsibilities and results in the editor, save, then tailor.
            Resume length and JD match depend on your evidence.
          </p>
          {state && !state.available ? (
            <p role="status">
              Paid Gemini is not configured. Local JD matching remains available
              in the editor.
            </p>
          ) : null}
        </>
      ) : null}
      {step === "evidence" && run ? (
        <div className="rf-tailoring-evidence">
          <h3>{run.jobTitle}</h3>
          <p>
            Saved resume evidence only. A missing qualification is a gap, never
            permission to add it.
          </p>
          <dl>
            <div>
              <dt>JD match using local rules</dt>
              <dd>
                {run.before.score == null
                  ? "Partial assessment"
                  : `${String(run.before.score)}/100`}
              </dd>
            </div>
            <div>
              <dt>Requested seniority</dt>
              <dd>{run.before.experienceLevel}</dd>
            </div>
            <div>
              <dt>Requested experience</dt>
              <dd>
                {run.before.statedYears == null
                  ? "Not stated"
                  : `${String(run.before.statedYears)}+ years`}
              </dd>
            </div>
            <div>
              <dt>Dated work history</dt>
              <dd>
                {run.before.datedYears == null
                  ? "Unknown; complete dates needed"
                  : `${String(run.before.datedYears)} years; overlaps counted once`}
              </dd>
            </div>
          </dl>
          <h4>Supported skills</h4>
          <p>
            {run.before.matched.join(", ") ||
              "No extracted skills have matching evidence."}
          </p>
          <h4>Missing evidence</h4>
          <p>
            {run.before.missing.join(", ") ||
              "No gaps found among extracted skills."}
          </p>
          <details>
            <summary>Required and preferred source phrases</summary>
            {run.requirements.map((k) => (
              <p key={k.name}>
                <strong>{k.name}</strong> ·{" "}
                {k.required ? "Required" : "Unspecified or preferred"}
                <br />
                {k.evidence}
              </p>
            ))}
            {run.responsibilities.map((v, i) => (
              <p key={i}>{v}</p>
            ))}
          </details>
          <p className="rf-tool-hint">
            Internal rubric, not an employer’s ATS result. Seniority and dated
            years are evidence; they do not change the score.
          </p>
        </div>
      ) : null}
      {step === "review" && run?.status === "ready" ? (
        <>
          <div className="rf-tailoring-review-heading">
            <h3>Keep the changes that fit your story</h3>
            <p>
              {selected.length} of {run.changes.length} proposals selected
            </p>
          </div>
          <label className="rf-tailoring-title">
            Copy name
            <input
              value={title}
              maxLength={200}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              disabled={busy}
            />
          </label>
          <p className="rf-tool-hint">
            Local JD score: {run.before.score ?? "partial"} before;{" "}
            {run.after?.score ?? "partial"} with all proposals. Wording may
            improve without increasing the score.
          </p>
          {run.quality ? (
            <p role="status" className="rf-tool-hint">
              {run.model} · {run.quality.fieldsChecked} professional fields
              checked · {run.quality.fieldsRewritten} rewritten.{" "}
              {run.quality.sourceWords} source words;{" "}
              {run.quality.proposedWords} with all proposals. All work,
              projects, education and saved skills remain in the copy.
            </p>
          ) : null}
          {run.warnings.map((warning) => (
            <p key={warning} role="status" className="rf-tool-hint">
              {warning}
            </p>
          ))}
          <div className="rf-tailoring-review">
            <div className="rf-tailoring-changes">
              {!run.changes.length ? (
                <p>
                  No supported changes were needed. You can still save a named
                  copy.
                </p>
              ) : null}
              {run.changes.map((c) => (
                <div
                  key={c.id}
                  className={
                    selected.includes(c.id)
                      ? "rf-tailoring-proposal"
                      : "rf-tailoring-proposal is-excluded"
                  }
                >
                  <RewriteTextChange change={c} />
                  <p className="rf-tool-hint">
                    {c.kind === "order"
                      ? c.scope === "sections"
                        ? "Professional evidence moves before education; all sections and hidden positions stay intact."
                        : "Existing visible items ranked by supported JD terms."
                      : run.promptVersion === "tailor-v2"
                        ? "Checked against cited professional facts and original detail coverage. Review meaning before saving."
                        : c.id === "supported-summary"
                          ? "Complete supported sentences selected from your professional entries."
                          : "Wording checked against this saved field’s facts and numbers."}
                  </p>
                  <details>
                    <summary>Supporting source</summary>
                    {(c.evidence.length ? c.evidence : [c.original]).map(
                      (text, i) => (
                        <p key={i}>{text}</p>
                      ),
                    )}
                  </details>
                  <Button
                    size="sm"
                    variant={selected.includes(c.id) ? "default" : "outline"}
                    aria-pressed={selected.includes(c.id)}
                    disabled={busy || stale}
                    onClick={() => {
                      setSelected((v) =>
                        v.includes(c.id)
                          ? v.filter((id) => id !== c.id)
                          : [...v, c.id],
                      );
                    }}
                  >
                    {selected.includes(c.id)
                      ? "Included · keep original instead"
                      : "Keep original · include change"}
                  </Button>
                </div>
              ))}
            </div>
            <aside
              className="rf-tailoring-preview"
              aria-label="Selected changes preview"
              style={appearanceVariables(
                preview.appearance ?? DEFAULT_APPEARANCE,
              )}
            >
              <h4>Preview of selected changes</h4>
              <ResumePage>
                <ResumeDocument
                  draft={preview}
                  editable={false}
                  selected={{ type: "header" }}
                  onPending={noop}
                  onSelect={noop}
                  onHover={noop}
                  onHoverExit={noop}
                  onEdit={noop}
                  onActions={noop}
                  onInlineCommit={() => false}
                  onRichChange={noop}
                />
              </ResumePage>
            </aside>
          </div>
        </>
      ) : null}
      {step === "export" && copyId ? (
        <>
          <h3>Your tailored copy is saved</h3>
          <p>
            Open the copy to edit, review its recalculated checks and download
            its saved PDF. Your original remains unchanged.
          </p>
        </>
      ) : null}
      {(run?.status === "failed" || run?.status === "cancelled") &&
      step !== "job" ? (
        <Button
          variant="outline"
          onClick={() => {
            setStep("job");
          }}
        >
          Start a new request
        </Button>
      ) : null}
    </Dialog>
  );
}
