import { AssessmentFeedback } from "./AssessmentFeedback";
import { useEffect, useRef, useState } from "react";
import { Button } from "@resume-forge/shared";
import type { ReadinessCheck } from "@resume-forge/resume-core";
import type { JdState } from "@resume-forge/shared-types";
import { targetLabel, type ResumeDraft } from "./editor-draft";
export interface JdServices {
  load: (signal?: AbortSignal) => Promise<JdState>;
  run: (text: string, semantic: boolean, consent: boolean) => Promise<JdState>;
  dismiss: (
    evaluationId: string,
    issueId: string,
    dismissed: boolean,
  ) => Promise<JdState>;
}
export function JdMatchPanel({
  draft,
  services,
  savedVersion,
  disabledReason,
  onTarget,
}: {
  draft: ResumeDraft;
  services?: JdServices;
  savedVersion: number;
  disabledReason?: string;
  onTarget: (check: ReadinessCheck, edit: boolean) => void;
}) {
  const [state, setState] = useState<JdState | null>(null),
    [text, setText] = useState(""),
    [semantic, setSemantic] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editingJd, setEditingJd] = useState(true);
  const identity = useRef(0),
    submitted = useRef(false),
    hydrated = useRef(false);
  useEffect(() => {
    if (!services) return;
    const abort = new AbortController(),
      id = ++identity.current;
    setBusy(false);
    submitted.current = false;
    void services
      .load(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted && id === identity.current) {
          setState(value);
          if (!hydrated.current) {
            setText(value.evaluation?.jdText ?? "");
            setSemantic(
              value.evaluation?.analysis === "gemini" ||
                (!value.evaluation && value.geminiAvailable),
            );
            setEditingJd(!value.evaluation);
            hydrated.current = true;
          }
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not load JD assessment.",
          );
      });
    return () => {
      abort.abort();
      identity.current = id + 1;
    };
  }, [services, savedVersion]);
  const evaluation = state?.evaluation,
    stale =
      !!evaluation &&
      (evaluation.resumeVersion !== savedVersion ||
        evaluation.jdText !== text.trim() ||
        evaluation.analysis !== (semantic ? "gemini" : "local"));
  const blocked = busy || !!disabledReason || !services;
  const mutate = async (operation: () => Promise<JdState>) => {
    if (submitted.current) return;
    submitted.current = true;
    const id = identity.current;
    setBusy(true);
    setError("");
    try {
      const value = await operation();
      if (id === identity.current) {
        setState(value);
        setEditingJd(false);
      }
    } catch (e) {
      if (id === identity.current)
        setError(e instanceof Error ? e.message : "JD analysis failed. Retry.");
    } finally {
      if (id === identity.current) {
        submitted.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <div className="rf-service-tools rf-jd-match">
      <section className="rf-ats-readiness" aria-label="Job description match">
        <div className="rf-ats-meter-heading">
          <h3>Match this job</h3>
          <span className="rf-ats-status">
            {busy
              ? "Analyzing…"
              : stale
                ? "Needs recheck"
                : evaluation?.partial
                  ? "Partial assessment"
                  : evaluation
                    ? "Evaluated"
                    : "Not evaluated"}
          </span>
        </div>
        <div className="rf-ats-score-value">
          <span>{evaluation?.score ?? "—"}</span>
          <span> / 100</span>
        </div>
        <div
          className="rf-ats-track"
          role="img"
          aria-label={
            evaluation?.score != null
              ? `JD heuristic ${String(evaluation.score)} out of 100`
              : "Overall JD score unavailable"
          }
        >
          {evaluation?.score != null ? (
            <span
              className="rf-readiness-fill"
              style={{ width: `${String(evaluation.score)}%` }}
            />
          ) : null}
        </div>
        <p>Compare saved facts with this JD. No hiring prediction.</p>
        {evaluation ? (
          <p>
            Saved v{evaluation.resumeVersion} ·{" "}
            {evaluation.analysis === "gemini"
              ? "Gemini evidence + fixed rules"
              : "Local fixed rules"}
          </p>
        ) : null}
      </section>
      <details
        className="rf-assessment-details rf-jd-edit"
        open={editingJd}
        onToggle={(event) => {
          setEditingJd(event.currentTarget.open);
        }}
      >
        <summary>
          {evaluation
            ? "Edit job description & recheck"
            : "Add job description"}
        </summary>
        <div className="rf-jd-composer">
          <label htmlFor="rf-jd-text">Job description</label>
          <textarea
            id="rf-jd-text"
            value={text}
            maxLength={12000}
            disabled={busy}
            placeholder="Paste responsibilities and required skills"
            onChange={(e) => {
              setText(e.target.value);
            }}
          />
          <div
            className="rf-ai-methods"
            role="group"
            aria-label="JD analysis method"
          >
            <Button
              size="sm"
              variant={semantic ? "outline" : "default"}
              aria-pressed={!semantic}
              disabled={busy}
              onClick={() => {
                setSemantic(false);
              }}
            >
              Local rules
            </Button>
            <Button
              size="sm"
              variant={semantic ? "default" : "outline"}
              aria-pressed={semantic}
              disabled={busy || !state?.geminiAvailable}
              onClick={() => {
                setSemantic(true);
              }}
            >
              Gemini + rules
            </Button>
          </div>
          <p className="rf-tool-hint">
            {semantic
              ? "Analyze sends JD responsibilities and visible professional entries to Gemini. Contacts are excluded. Private search embeddings stay bound to this saved version."
              : "Local rules compare your saved resume with this JD without an AI request."}
          </p>
          {state && !state.geminiAvailable ? (
            <p className="rf-tool-hint">
              Gemini needs server credentials and paid data mode. Local matching
              remains available.
            </p>
          ) : null}
          {disabledReason ? <p role="status">{disabledReason}</p> : null}
          <Button
            size="sm"
            disabled={blocked || text.trim().length < 50}
            aria-busy={busy}
            onClick={() => {
              if (services)
                void mutate(() => services.run(text, semantic, semantic));
            }}
          >
            {busy
              ? "Analyzing…"
              : evaluation
                ? "Recheck this JD"
                : "Analyze this JD"}
          </Button>
          {error ? (
            <p role="alert" className="rf-ai-error">
              {error}
            </p>
          ) : null}
        </div>
      </details>
      {error && !editingJd ? (
        <p role="alert" className="rf-ai-error">
          {error}
        </p>
      ) : null}
      {stale ? (
        <p role="status">
          This evidence belongs to an older resume, JD or analysis mode. Recheck
          before using its actions.
        </p>
      ) : null}
      {evaluation ? (
        <>
          <AssessmentFeedback
            checks={evaluation.checks}
            dismissed={state.dismissed}
            disabled={blocked || stale}
            label={(check) =>
              check.target ? targetLabel(draft, check.target) : ""
            }
            onTarget={onTarget}
            onDismiss={
              services
                ? (check, hidden) => {
                    void mutate(() =>
                      services.dismiss(evaluation.id, check.id, hidden),
                    );
                  }
                : undefined
            }
          />
          <details className="rf-assessment-details">
            <summary>Score breakdown</summary>
            <section
              className="rf-readiness-components"
              aria-label="JD breakdown"
            >
              {evaluation.components.map((c) => (
                <div key={c.id}>
                  <span>
                    {c.label}
                    <small>{c.weight}% weight</small>
                  </span>
                  <strong>
                    {c.score == null ? "Unavailable" : `${String(c.score)}/100`}
                  </strong>
                </div>
              ))}
            </section>
          </details>
          <details className="rf-assessment-details">
            <summary>Skills & responsibility evidence</summary>
            <details className="rf-jd-evidence">
              <summary>Matched and missing skills</summary>
              {evaluation.skills.map((s) => (
                <p key={s.term}>
                  <strong>
                    {s.matched ? "Supported" : "Missing evidence"}
                  </strong>
                  : {s.term}
                </p>
              ))}
              {!evaluation.skills.length ? (
                <p>No skill criteria detected.</p>
              ) : null}
            </details>
            <details className="rf-jd-evidence">
              <summary>Required keyword evidence</summary>
              {evaluation.keywords.map((s) => (
                <p key={s.term}>
                  {s.matched ? "Found" : "Missing"}: {s.term}
                </p>
              ))}
            </details>
            <details className="rf-jd-evidence">
              <summary>Responsibility evidence</summary>
              {evaluation.responsibilities.map((row, i) => (
                <p key={i}>
                  <strong>
                    {row.matched ? "Supported" : "Missing evidence"}
                  </strong>
                  : {row.requirement}
                  <br />
                  {row.method === "semantic"
                    ? "Validated Gemini correspondence"
                    : "Term overlap"}
                  {row.target ? ` · ${targetLabel(draft, row.target)}` : ""}
                </p>
              ))}
            </details>
            <details className="rf-jd-evidence">
              <summary>Method and limits</summary>
              {evaluation.retrieval ? (
                <p>
                  {evaluation.retrieval.indexedChunks} professional entries
                  indexed; {evaluation.retrieval.reusedChunks} reused.{" "}
                  {evaluation.retrieval.hits.length} evidence candidates.
                  Similarity alone does not earn points.
                </p>
              ) : null}
              {evaluation.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              <p>
                {evaluation.rubricVersion}
                {evaluation.model ? ` · ${evaluation.model}` : ""}
              </p>
            </details>
          </details>
        </>
      ) : (
        <p className="rf-tool-hint">
          Your JD and assessment are stored privately after analysis. Resume
          readiness works without a JD.
        </p>
      )}
    </div>
  );
}
