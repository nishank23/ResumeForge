import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  RequestFeedback,
  Select,
  StudioPrompt,
} from "@resume-forge/shared";
import {
  applyTailoringPreview,
  type TailoringState,
  type TailoringFact,
  type JdState,
} from "@resume-forge/shared-types";
import type { SavedResume } from "./resume-api";
import type { ResumeDraft } from "./editor-draft";
import { RewriteTextChange } from "./RewriteTextChange";
import { ResumePage } from "./ResumePage";
import { ResumeDocument } from "./ResumeDocument";
import { TailoringExperience } from "./TailoringExperience";
import {
  confirmExperience,
  experienceEntries,
  experienceQuestionLabel,
  type ExperienceAnswer,
} from "./tailoring-experience";
import { appearanceVariables, DEFAULT_APPEARANCE } from "./editor-appearance";
import "./improve-with-ai.css";
import "./tailoring.css";

export interface TailoringServices {
  load: (signal?: AbortSignal) => Promise<TailoringState>;
  analyze: (text: string) => Promise<JdState>;
  start: (
    id: string,
    text: string,
    facts: TailoringFact[],
  ) => Promise<TailoringState>;
  cancel: (id: string) => Promise<TailoringState>;
  apply: (
    id: string,
    selected: string[],
    title: string,
  ) => Promise<SavedResume>;
  downloadCopy: (id: string, version?: number, title?: string) => Promise<void>;
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
  const [state, setState] = useState<TailoringState | null>(null);
  const [text, setText] = useState(initialJd);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(`${base.title} · tailored`.slice(0, 200));
  const [step, setStep] = useState<"job" | "review" | "ready">("job");
  const [answers, setAnswers] = useState<ExperienceAnswer[]>([]);
  const [preparation, setPreparation] = useState<{
    text: string;
    state: JdState;
  } | null>(null);
  const [factsConfirmed, setFactsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copy, setCopy] = useState<{
    id: string;
    version?: number;
    title?: string;
  } | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [pdfStarted, setPdfStarted] = useState(false);
  const [reviewView, setReviewView] = useState<"changes" | "preview">(
    "changes",
  );
  const [activeChange, setActiveChange] = useState(0);
  const controls = useRef<HTMLDivElement>(null);
  const live = useRef(true),
    stages = useRef<HTMLElement>(null),
    previousStep = useRef(step);
  const submitted = useRef(false),
    initializedRun = useRef(""),
    initializedChoices = useRef(""),
    initializedSaved = useRef("");
  const requestId = useRef<string | null>(null);
  const isLive = () => live.current;
  const run = state?.run;
  const running = run?.status === "queued" || run?.status === "drafting";
  const stale =
    !!run &&
    run.status !== "saved" &&
    (run.sourceVersion !== savedVersion ||
      Date.now() > Date.parse(run.expiresAt));
  const pendingAnswers = answers.filter((a) => a.text.trim());
  const blocked = busy || !!disabledReason || stale;
  const canStart =
    !busy &&
    !running &&
    !disabledReason &&
    state?.available &&
    text.trim().length >= 50 &&
    text.length <= 12000 &&
    (!pendingAnswers.length || factsConfirmed);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stages.current?.focus({ preventScroll: true });
    if (controls.current) controls.current.scrollTop = 0;
    setReviewView("changes");
  }, [step]);
  const acceptState = useCallback((next: TailoringState) => {
    setState(next);
    if (next.run && next.run.id !== initializedRun.current) {
      initializedRun.current = next.run.id;
      setText(next.run.jdText);
      setAnswers(
        next.run.additionalFacts.map(
          ({ confirmed: _confirmed, ...fact }) => fact,
        ),
      );
      if (["queued", "drafting"].includes(next.run.status)) setStep("review");
    }
    if (
      next.run?.status === "saved" &&
      initializedSaved.current !== next.run.id
    ) {
      initializedSaved.current = next.run.id;
      setCopy(next.run.copyId ? { id: next.run.copyId } : null);
      setStep("ready");
    }
    if (
      next.run?.status === "ready" &&
      initializedChoices.current !== next.run.id
    ) {
      initializedChoices.current = next.run.id;
      setSelected(next.run.changes.map((c) => c.id));
      setActiveChange(0);
      setStep("review");
    }
  }, []);
  useEffect(() => {
    live.current = true;
    const abort = new AbortController();
    void services
      .load(abort.signal)
      .then((next) => {
        if (abort.signal.aborted) return;
        const differentJob =
          !!initialJd.trim() &&
          !!next.run &&
          next.run.jdText.trim() !== initialJd.trim();
        if (
          differentJob &&
          next.run &&
          !["queued", "drafting"].includes(next.run.status)
        ) {
          // An explicit target job takes precedence over an older completed run.
          // Keep that run on the server; only show a fresh intake locally.
          acceptState({ ...next, run: null });
        } else {
          acceptState(next);
          if (differentJob)
            setError(
              "Tailoring for another job is already in progress. Finish or cancel it, then reopen Tailor for this job.",
            );
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "Could not load tailoring. Close and reopen to retry.",
          );
      });
    return () => {
      live.current = false;
      abort.abort();
    };
  }, [services, acceptState, initialJd]);
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
              : "Could not refresh progress. Close and reopen to retry.",
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
  const preview = useMemo(
    () =>
      step === "review" && run && !stale && run.status === "ready"
        ? applyTailoringPreview(base, run.changes, selected)
        : base,
    [base, run, selected, stale, step],
  );
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
        setError(
          e instanceof Error
            ? e.message
            : "Tailoring failed. Your original is unchanged. Retry.",
        );
    } finally {
      submitted.current = false;
      if (live.current) setBusy(false);
    }
  };
  const prepare = async () => {
    if (
      preparation?.text === text &&
      preparation.state.currentVersion === savedVersion
    )
      return preparation.state;
    const prepared = await services.analyze(text);
    if (
      prepared.currentVersion !== savedVersion ||
      prepared.evaluation?.resumeVersion !== savedVersion
    )
      throw new Error(
        "Your saved version changed. Reopen the resume before tailoring.",
      );
    if (live.current) setPreparation({ text, state: prepared });
    return prepared;
  };
  const start = () => {
    if (!canStart) return;
    const id = requestId.current ?? crypto.randomUUID();
    requestId.current = id;
    // Preflight remains local; only the clearly labeled primary action submits confirmed professional facts.
    void mutate(async () => {
      const facts = confirmExperience(base, answers);
      await prepare();
      if (!isLive()) return null;
      const next = await services.start(id, text, facts);
      requestId.current = null;
      if (live.current) {
        setStep("review");
        setPdfStarted(false);
        setPdfError("");
        setCopy(null);
      }
      return next;
    });
  };
  const exportCopy = async (saved: {
    id: string;
    version?: number;
    title?: string;
  }) => {
    try {
      await services.downloadCopy(saved.id, saved.version, saved.title);
      if (live.current) {
        setPdfStarted(true);
        setPdfError("");
      }
    } catch (e) {
      if (live.current)
        setPdfError(
          e instanceof Error
            ? e.message
            : "Your copy is saved, but PDF download failed. Retry the download.",
        );
    }
  };
  const save = () => {
    if (!run || run.status !== "ready" || blocked || !title.trim()) return;
    void mutate(async () => {
      const saved = await services.apply(run.id, selected, title);
      const nextCopy = {
        id: saved.id,
        version: saved.currentVersion,
        title: saved.title,
      };
      if (live.current) {
        initializedSaved.current = run.id;
        setCopy(nextCopy);
        setStep("ready");
        setPdfError("");
        setState((previous) =>
          previous?.run
            ? {
                ...previous,
                run: { ...previous.run, status: "saved", copyId: saved.id },
              }
            : previous,
        );
      }
      // Export failure never retries Apply or loses the saved copy's identity.
      await exportCopy(nextCopy);
      return null;
    });
  };
  const reset = () => {
    setStep("job");
    setReviewView("changes");
    setActiveChange(0);
    setAnswers([]);
    setFactsConfirmed(false);
    setPreparation(null);
    setError("");
    setCopy(null);
    setPdfError("");
    setPdfStarted(false);
    setState((previous) => (previous ? { ...previous, run: null } : previous));
    requestId.current = null;
  };
  return (
    <Dialog
      open
      title="Tailor for a job"
      description="Create a separate copy for this job."
      className="rf-ai-dialog rf-tailoring-dialog rf-tailoring-ux"
      bodyClassName="rf-ai-dialog-body"
      footerClassName="rf-ai-dialog-footer"
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      footer={
        <>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {running ? "Close and continue later" : "Back to resume"}
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
          {step === "job" && !running ? (
            <Button disabled={!canStart} onClick={start}>
              {busy ? "Preparing tailoring…" : "Tailor my resume"}
            </Button>
          ) : null}
          {step === "review" && run?.status === "ready" ? (
            <Button disabled={blocked || !title.trim()} onClick={save}>
              {busy ? "Saving copy…" : "Save copy & download PDF"}
            </Button>
          ) : null}
          {step === "ready" && copy ? (
            <Button
              disabled={busy}
              onClick={() =>
                void mutate(async () => {
                  await exportCopy(copy);
                  return null;
                })
              }
            >
              {busy
                ? "Preparing PDF…"
                : pdfStarted
                  ? "Download PDF again"
                  : "Download PDF"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="rf-tailoring-toolbar">
        <nav
          ref={stages}
          tabIndex={-1}
          className="rf-tailoring-stages"
          aria-label="Tailoring stages"
        >
          {(["job", "review", "ready"] as const).map((s) => (
            <Button
              key={s}
              variant="ghost"
              aria-current={step === s ? "step" : undefined}
              disabled={
                busy ||
                running ||
                (s === "review" && run?.status !== "ready") ||
                (s === "ready" && !copy)
              }
              onClick={() => {
                setStep(s);
                setReviewView("changes");
              }}
            >
              {s === "job"
                ? "Job description"
                : s === "review"
                  ? "Review changes"
                  : "Saved copy"}
            </Button>
          ))}
        </nav>
        <div className="rf-tailoring-view-switch" aria-label="Tailoring view">
          <Button
            variant="ghost"
            aria-pressed={reviewView === "changes"}
            onClick={() => {
              setReviewView("changes");
            }}
          >
            {step === "job"
              ? "Job details"
              : step === "review"
                ? "Changes"
                : "Saved copy"}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={reviewView === "preview"}
            onClick={() => {
              setReviewView("preview");
            }}
          >
            Preview
          </Button>
        </div>
      </div>
      <div className="rf-tailoring-layout" data-review-view={reviewView}>
        <div
          className="rf-tailoring-controls"
          ref={controls}
          tabIndex={0}
          aria-label="Tailoring details"
        >
          {disabledReason ? <p role="status">{disabledReason}</p> : null}
          {stale ? (
            <div className="rf-tailoring-blocked" role="status">
              <p>These suggestions expired or use an older version.</p>
              <Button variant="outline" disabled={busy} onClick={reset}>
                Start a fresh request
              </Button>
            </div>
          ) : null}
          {run?.status === "cancelled" ? (
            <p role="status">
              Tailoring cancelled. Your original resume is unchanged.
            </p>
          ) : null}
          {error || run?.error ? (
            <p role="alert" className="rf-ai-error">
              {error || run?.error}
            </p>
          ) : null}
          {running ? (
            <div className="rf-tailoring-progress">
              <RequestFeedback
                key={`${run.status}:${String(run.batchesDone)}`}
                label={
                  run.status === "queued" && run.batchesDone === 0
                    ? "Preparing your tailored resume"
                    : run.promptVersion !== "tailor-v1" &&
                        [1, 3].includes(run.batchesDone)
                      ? run.batchesDone === 3
                        ? "Final fact and coverage check"
                        : "Checking facts and source coverage"
                      : run.batchesDone === 2
                        ? "Refining wording after fact review"
                        : "Writing your role-targeted resume"
                }
                reducedMotion={reducedMotion}
              />
              <p>
                {run.batchesDone} of {run.batchesTotal} processing stages
                complete. You can close and return while this continues.
              </p>
            </div>
          ) : null}
          {step === "job" && !running ? (
            <div className="rf-tailoring-job">
              <StudioPrompt
                label="Target job description"
                value={text}
                onChange={(v) => {
                  setText(v);
                  setFactsConfirmed(false);
                  setPreparation(null);
                  requestId.current = null;
                }}
                placeholder="Paste the role, responsibilities and required skills"
                disabled={busy}
                submitLabel="Tailor my resume"
                submitDisabled={!canStart}
                hideSubmit
                onSubmit={start}
              />
              {text.trim().length >= 50 ? (
                <details
                  className="rf-tailoring-optional"
                  onToggle={(event) => {
                    if (
                      event.currentTarget.open &&
                      text.trim().length >= 50 &&
                      text.length <= 12000 &&
                      !busy &&
                      !disabledReason &&
                      state?.available
                    )
                      void mutate(async () => {
                        await prepare();
                        return null;
                      });
                  }}
                >
                  <summary>Add experience I left out (optional)</summary>
                  <TailoringExperience
                    doc={base}
                    answers={answers}
                    terms={
                      preparation?.text === text
                        ? (preparation.state.evaluation?.keywords.map(
                            (keyword) => keyword.term,
                          ) ?? [])
                        : []
                    }
                    disabled={busy || !!disabledReason}
                    onChange={(next) => {
                      setAnswers(next);
                      setFactsConfirmed(false);
                      setError("");
                      requestId.current = null;
                    }}
                  />
                </details>
              ) : null}
              {pendingAnswers.length ? (
                <section
                  className="rf-experience-confirm"
                  aria-label="Confirm added facts"
                >
                  <h4>Your added facts</h4>
                  {experienceEntries(base)
                    .filter((e) =>
                      pendingAnswers.some(
                        (a) =>
                          a.sectionId === e.sectionId && a.itemId === e.itemId,
                      ),
                    )
                    .map((entry) => (
                      <div
                        className="rf-experience-confirm-row"
                        key={entry.itemId}
                      >
                        <h4>{entry.title}</h4>
                        <dl>
                          {pendingAnswers
                            .filter(
                              (a) =>
                                a.sectionId === entry.sectionId &&
                                a.itemId === entry.itemId,
                            )
                            .map((a) => (
                              <div key={a.kind}>
                                <dt>{experienceQuestionLabel(a.kind)}</dt>
                                <dd>{a.text}</dd>
                              </div>
                            ))}
                        </dl>
                      </div>
                    ))}
                  <Checkbox
                    label="I confirm these added facts describe my own work."
                    description="Use them only for this tailored copy, tied to the original role or project."
                    checked={factsConfirmed}
                    disabled={busy}
                    onChange={(event) => {
                      setFactsConfirmed(event.target.checked);
                    }}
                  />
                </section>
              ) : null}
              <details className="rf-tailoring-privacy">
                <summary>What is sent to AI?</summary>
                <p className="rf-ai-scope">
                  Tailor my resume sends saved professional facts, job
                  requirements and any confirmed additions to Gemini. Identity,
                  contacts, dates, hidden content and original files stay out.
                  Unsupported qualifications remain gaps.
                </p>
              </details>
              {text.length > 12000 ? (
                <p role="alert">
                  Keep the job description within 12,000 characters.
                </p>
              ) : text.trim().length > 0 && text.trim().length < 50 ? (
                <p className="rf-tool-hint">
                  Paste at least 50 characters from the job description.
                </p>
              ) : null}
              {state && !state.available ? (
                <p role="status">
                  AI tailoring is unavailable. You can still edit your resume
                  and check job fit.
                </p>
              ) : null}
            </div>
          ) : null}
          {step === "review" && run?.status === "ready" ? (
            <section className="rf-tailoring-review">
              <div className="rf-tailoring-changes">
                <div className="rf-tailoring-review-heading">
                  <p>
                    {selected.length} of {run.changes.length} suggestions
                    included.
                  </p>
                </div>
                {run.changes.length > 1 ? (
                  <div className="rf-tailoring-change-navigation">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Previous suggestion"
                      disabled={activeChange === 0}
                      onClick={() => {
                        setActiveChange((i) => i - 1);
                      }}
                    >
                      <ChevronLeft size={18} aria-hidden="true" />
                    </Button>
                    <Select
                      aria-label="Choose suggestion"
                      value={String(activeChange)}
                      onChange={(event) => {
                        setActiveChange(Number(event.target.value));
                      }}
                      options={run.changes.map((change, i) => ({
                        value: String(i),
                        label: `${String(i + 1)} of ${String(run.changes.length)} · ${change.label}`,
                      }))}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Next suggestion"
                      disabled={activeChange === run.changes.length - 1}
                      onClick={() => {
                        setActiveChange((i) => i + 1);
                      }}
                    >
                      <ChevronRight size={18} aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
                {!run.changes.length ? (
                  <p>
                    No supported changes were needed. You can still save a
                    separate named copy.
                  </p>
                ) : null}
                {run.changes.slice(activeChange, activeChange + 1).map((c) => (
                  <section
                    key={c.id}
                    className={`rf-tailoring-proposal${selected.includes(c.id) ? "" : " is-excluded"}`}
                  >
                    <Checkbox
                      label={`Use suggestion: ${c.label}`}
                      description={
                        selected.includes(c.id)
                          ? "Uncheck to keep your original wording."
                          : "Your original wording is kept."
                      }
                      checked={selected.includes(c.id)}
                      disabled={busy || stale}
                      onChange={() => {
                        setSelected((value) =>
                          value.includes(c.id)
                            ? value.filter((id) => id !== c.id)
                            : [...value, c.id],
                        );
                      }}
                    />
                    <RewriteTextChange
                      change={c}
                      suggestionFirst
                      comparisonDetails={
                        <>
                          <p>
                            {c.kind === "order"
                              ? "Reorders existing content using supported job requirements. Nothing is removed."
                              : "Checked against professional facts and original coverage. Review the meaning before saving."}
                          </p>
                          {(c.evidence.length ? c.evidence : [c.original]).map(
                            (evidence, i) => (
                              <p key={i}>{evidence}</p>
                            ),
                          )}
                        </>
                      }
                    />
                  </section>
                ))}
                {run.warnings.map((warning) => (
                  <p key={warning} role="status" className="rf-tool-hint">
                    {warning}
                  </p>
                ))}

                <details className="rf-tailoring-copy-options">
                  <summary>Copy name and job-fit details</summary>
                  <label className="rf-tailoring-title">
                    Copy name
                    <Input
                      value={title}
                      maxLength={200}
                      disabled={busy}
                      onChange={(event) => {
                        setTitle(event.target.value);
                      }}
                    />
                  </label>
                  <div className="rf-tailoring-check-details">
                    <p>
                      Evidence still missing:{" "}
                      {run.before.missing.join(", ") ||
                        "No gaps among extracted terms."}{" "}
                      Missing qualifications are not added to your resume.
                    </p>
                    <p>
                      Requested seniority: {run.before.experienceLevel}.
                      Requested experience:{" "}
                      {run.before.statedYears == null
                        ? "Not stated"
                        : `${String(run.before.statedYears)}+ years`}
                      . These are evidence details, not score multipliers.
                    </p>
                    {run.responsibilities.map((responsibility, i) => (
                      <p key={`responsibility-${String(i)}`}>
                        {responsibility}
                      </p>
                    ))}
                    {run.quality ? (
                      <p>
                        {run.model}: {run.quality.fieldsChecked} fields checked,{" "}
                        {run.quality.fieldsRewritten} rewritten.{" "}
                        {run.quality.sourceWords} original words;{" "}
                        {run.quality.proposedWords} with all suggestions.
                        Original work, projects, education and skills remain in
                        the copy.
                      </p>
                    ) : null}
                    {run.requirements.map((k) => (
                      <p key={k.name}>
                        <strong>{k.name}</strong> —{" "}
                        {k.required ? "Required" : "Preferred or unspecified"}
                        <br />
                        {k.evidence}
                      </p>
                    ))}
                  </div>
                </details>
              </div>
            </section>
          ) : null}
          {step === "ready" && copy ? (
            <section className="rf-tailoring-ready">
              <h3>Your tailored copy is saved</h3>
              <p>
                {pdfStarted
                  ? "PDF download started. Your original resume is unchanged."
                  : "Your original is unchanged. Download the saved copy or open it to keep editing."}
              </p>
              {pdfError ? (
                <p role="alert" className="rf-ai-error">
                  {pdfError} Your copy is already saved; retrying downloads it
                  without creating another copy.
                </p>
              ) : null}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  services.openCopy(copy.id);
                }}
              >
                Open tailored resume
              </Button>
              <Button variant="ghost" disabled={busy} onClick={reset}>
                Tailor for another job
              </Button>
            </section>
          ) : null}
          {(run?.status === "failed" || run?.status === "cancelled") &&
          !running ? (
            <Button variant="outline" disabled={busy} onClick={reset}>
              Start a fresh request
            </Button>
          ) : null}
        </div>
        <aside
          className="rf-tailoring-preview"
          aria-label="Selected changes preview"
          style={appearanceVariables(preview.appearance ?? DEFAULT_APPEARANCE)}
          tabIndex={0}
        >
          <div className="rf-tailoring-preview-heading">
            <h3>
              {step === "review" && run?.status === "ready" && !stale
                ? "Preview of selected changes"
                : "Original saved resume"}
            </h3>
          </div>
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
    </Dialog>
  );
}
