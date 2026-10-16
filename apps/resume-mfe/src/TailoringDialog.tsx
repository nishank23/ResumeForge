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
  experiencePrompts,
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
    [step, setStep] = useState<
      "job" | "experience" | "evidence" | "review" | "export"
    >("job"),
    [preparation, setPreparation] = useState<JdState | null>(null),
    [answers, setAnswers] = useState<ExperienceAnswer[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copyId, setCopyId] = useState<string | null>(null);
  const live = useRef(true),
    stages = useRef<HTMLElement>(null),
    previousStep = useRef(step),
    submitted = useRef(false),
    initializedRun = useRef(""),
    initializedChoices = useRef(""),
    initializedSaved = useRef(""),
    requestId = useRef<string | null>(null);
  const run = state?.run,
    running = run?.status === "queued" || run?.status === "drafting";
  const stale =
    !!run &&
    run.status !== "saved" &&
    (run.sourceVersion !== savedVersion ||
      Date.now() > Date.parse(run.expiresAt));
  const blocked = busy || !!disabledReason || stale;
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stages.current?.focus({ preventScroll: true });
    stages.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [step]);
  const acceptState = useCallback((next: TailoringState) => {
    setState(next);
    if (next.run?.id !== initializedRun.current && next.run) {
      initializedRun.current = next.run.id;
      setText(next.run.jdText);
      setCopyId(next.run.copyId);
      setAnswers(
        next.run.additionalFacts.map(
          ({ confirmed: _confirmed, ...fact }) => fact,
        ),
      );
      if (["queued", "drafting"].includes(next.run.status)) setStep("evidence");
    }
    if (
      next.run?.status === "saved" &&
      initializedSaved.current !== next.run.id
    ) {
      initializedSaved.current = next.run.id;
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
  const missing =
    preparation?.evaluation?.keywords
      .filter((k) => !k.matched)
      .map((k) => k.term) ??
    run?.before.missing ??
    [];
  const pendingAnswers = answers.filter((a) => a.text.trim());
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
      const facts = confirmExperience(base, answers);
      const next = await services.start(id, text, facts);
      requestId.current = null;
      setPreparation(null);
      setStep("evidence");
      return next;
    });
  };
  const analyze = () => {
    if (
      running ||
      busy ||
      disabledReason ||
      text.trim().length < 50 ||
      text.length > 12000
    )
      return;
    void mutate(async () => {
      const next = await services.analyze(text);
      if (
        next.currentVersion !== savedVersion ||
        !next.evaluation ||
        next.evaluation.resumeVersion !== savedVersion
      )
        throw new Error(
          "Your saved version changed. Reopen the resume before tailoring.",
        );
      if (live.current) {
        setPreparation(next);
        setStep(
          experiencePrompts(
            base,
            next.evaluation.keywords.map((k) => k.term),
          ).length
            ? "experience"
            : "evidence",
        );
      }
      return null;
    });
  };
  const save = () => {
    if (!run || run.status !== "ready" || blocked) return;
    void mutate(async () => {
      const copy = await services.apply(run.id, selected, title);
      if (live.current) {
        initializedSaved.current = run.id;
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
          {step === "experience" && preparation && !running ? (
            <Button
              disabled={busy || !!disabledReason}
              onClick={() => {
                try {
                  confirmExperience(base, answers);
                  setError("");
                  setStep("evidence");
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Check the details you added.",
                  );
                }
              }}
            >
              {pendingAnswers.length
                ? "Review added facts"
                : "Continue with saved facts"}
            </Button>
          ) : null}
          {step === "evidence" && preparation && !running ? (
            <Button
              disabled={busy || !!disabledReason || !state?.available}
              onClick={start}
            >
              {busy
                ? "Starting tailoring…"
                : pendingAnswers.length
                  ? "Confirm facts and tailor"
                  : "Tailor with saved facts"}
            </Button>
          ) : null}
          {step === "review" && run?.status === "ready" ? (
            <Button disabled={blocked || !title.trim()} onClick={save}>
              {busy ? "Saving…" : "Save tailored resume"}
            </Button>
          ) : null}
          {copyId && step === "export" ? (
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
      <nav
        ref={stages}
        tabIndex={-1}
        className="rf-tailoring-stages"
        aria-label="Tailoring stages"
      >
        {(["job", "experience", "evidence", "review", "export"] as const).map(
          (s, i) => (
            <button
              key={s}
              aria-current={step === s ? "step" : undefined}
              disabled={
                busy ||
                (s === "experience" && !preparation && !run) ||
                (s === "evidence" && !run && !preparation) ||
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
                : s === "experience"
                  ? "Optional details"
                  : s === "evidence"
                    ? "Confirm facts"
                    : s === "review"
                      ? "Review"
                      : "Export"}
            </button>
          ),
        )}
      </nav>
      {disabledReason ? <p role="status">{disabledReason}</p> : null}
      {stale && (!preparation || step === "review") ? (
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
            {run.batchesDone} of {run.batchesTotal} stages complete. You can
            close this dialog and reopen it to check progress.
          </p>
        </div>
      ) : null}
      {step === "job" && !running ? (
        <>
          <h3>Start with the role you want</h3>
          <p>
            Start with your saved resume. Add missing professional details
            before Gemini writes a tailored copy. Your original and master
            profile stay unchanged.
          </p>
          <StudioPrompt
            label="Target job description"
            value={text}
            onChange={(v) => {
              setText(v);
              setPreparation(null);
              requestId.current = null;
            }}
            placeholder="Paste the role, responsibilities and required skills"
            disabled={busy || running}
            submitLabel={
              busy ? "Checking job requirements…" : "Find gaps and continue"
            }
            submitDisabled={
              busy ||
              running ||
              !!disabledReason ||
              !state?.available ||
              text.trim().length < 50 ||
              text.length > 12000
            }
            onSubmit={analyze}
          />
          <p className="rf-ai-scope">
            This first check uses local rules. Gemini receives professional
            facts only after you confirm the next step. Identity, contacts,
            dates, hidden content and source files are excluded.
          </p>
          <p className="rf-tool-hint">
            Have a short resume? Describe work you left out in the next step.
            Resume length and JD match depend on your actual evidence.
          </p>
          {state && !state.available ? (
            <p role="status">
              Paid Gemini is not configured. Local JD matching remains available
              in the editor.
            </p>
          ) : null}
        </>
      ) : null}
      {step === "experience" && !running ? (
        <TailoringExperience
          doc={base}
          answers={answers}
          terms={
            preparation?.evaluation?.keywords.map((k) => k.term) ??
            run?.requirements.map((k) => k.name) ??
            []
          }
          disabled={busy || running || !!disabledReason || !preparation}
          onChange={(next) => {
            setAnswers(next);
            setError("");
            requestId.current = null;
          }}
        />
      ) : null}
      {step === "evidence" && !running ? (
        <div className="rf-experience-confirm">
          <h3>
            {preparation
              ? "Check the facts you want to add"
              : "Facts used for this tailoring"}
          </h3>
          <p>
            {pendingAnswers.length
              ? "Confirm that these details describe your own work. They will be used only for this tailored copy, with their original role or project."
              : "No additional facts. Tailoring will use your saved professional experience only."}
          </p>
          {experienceEntries(base)
            .filter((e) =>
              pendingAnswers.some(
                (a) => a.sectionId === e.sectionId && a.itemId === e.itemId,
              ),
            )
            .map((entry) => (
              <section className="rf-experience-confirm-row" key={entry.itemId}>
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
              </section>
            ))}
          {preparation ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setStep("experience");
                }}
              >
                Edit answers
              </Button>
              <div className="rf-experience-match">
                <h4>Job match before tailoring</h4>
                <p>
                  {preparation.evaluation?.score ?? "Partial assessment"}
                  {preparation.evaluation?.score != null ? "/100" : ""} using
                  local rules.
                </p>
                <p>
                  <strong>Evidence still missing:</strong>{" "}
                  {missing.join(", ") ||
                    "No gaps among the extracted keywords."}
                </p>
                <p>
                  Unconfirmed requirements stay gaps. Final checks use only the
                  changes you accept.
                </p>
              </div>
              <p className="rf-ai-scope">
                Confirm facts and tailor sends these answers, saved professional
                descriptions, role titles, skills/tools and job requirements to
                Gemini 3.8 Flash. Keep contacts, links and personal identity out
                of answers. Review every proposal before saving.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
      {step === "evidence" && run && !preparation && !running ? (
        <div className="rf-tailoring-evidence">
          <h3>{run.jobTitle}</h3>
          <p>
            The initial match uses saved resume evidence. Confirmed answers can
            add support in the tailored copy; remaining qualifications stay
            gaps.
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
                      : run.promptVersion !== "tailor-v1"
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
