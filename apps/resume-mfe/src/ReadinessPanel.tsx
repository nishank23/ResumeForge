import { useEffect, useRef, useState } from "react";
import { Button } from "@resume-forge/shared";
import type {
  ReadinessCheck,
  ReadinessResult,
} from "@resume-forge/resume-core";
import type { ReadinessState } from "@resume-forge/shared-types";
import { AssessmentFeedback } from "./AssessmentFeedback";
import { READINESS_RUBRIC } from "@resume-forge/resume-core";
import { needsReadinessCheck } from "./readiness-feedback";
export interface ReadinessPanelProps {
  savedVersion: number;
  disabledReason?: string;
  navigationDisabled?: boolean;
  preview?: ReadinessResult;
  load?: (signal?: AbortSignal) => Promise<ReadinessState>;
  run?: () => Promise<ReadinessState>;
  dismiss?: (
    evaluationId: string,
    issueId: string,
    dismissed: boolean,
  ) => Promise<ReadinessState>;
  label?: (check: ReadinessCheck) => string;
  onTarget: (check: ReadinessCheck, edit: boolean) => void;
}
export function ReadinessPanel({
  savedVersion,
  disabledReason,
  navigationDisabled,
  preview,
  load,
  run,
  dismiss,
  onTarget,
  label,
}: ReadinessPanelProps) {
  const [state, setState] = useState<ReadinessState | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  const canCheck = !disabledReason;
  useEffect(() => {
    if (!load) return;
    const abort = new AbortController();
    const identity = ++request.current;
    setBusy(false);
    setLoading(true);
    setError("");
    void (async () => {
      try {
        let value = await load(abort.signal);
        if (abort.signal.aborted) return;
        setState(value);
        if (canCheck && run && needsReadinessCheck(value, savedVersion)) {
          value = await run();
        }
        if (identity === request.current) setState(value);
      } catch (e) {
        if (!abort.signal.aborted && identity === request.current)
          setError(
            e instanceof Error
              ? e.message
              : "Could not check readiness. Retry.",
          );
      } finally {
        if (!abort.signal.aborted && identity === request.current)
          setLoading(false);
      }
    })();
    return () => {
      abort.abort();
      request.current = identity + 1;
    };
  }, [load, run, savedVersion, retry, canCheck]);
  const evaluation = state?.evaluation;
  const result = preview ?? evaluation;
  const stale =
    !!evaluation &&
    (evaluation.resumeVersion !== savedVersion ||
      state.currentVersion !== savedVersion || evaluation.rubricVersion !== READINESS_RUBRIC);
  const blocked = busy || loading || !!disabledReason || !run;
  const mutate = async (operation: () => Promise<ReadinessState>) => {
    if (busy) return;
    const identity = request.current;
    setBusy(true);
    setError("");
    try {
      const value = await operation();
      if (identity === request.current) setState(value);
    } catch (e) {
      if (identity === request.current)
        setError(
          e instanceof Error ? e.message : "Readiness request failed. Retry.",
        );
    } finally {
      if (identity === request.current) setBusy(false);
    }
  };
  return (
    <div className="rf-service-tools">
      <section
        className="rf-ats-readiness"
        aria-labelledby="rf-ats-meter-heading"
      >
        <div className="rf-ats-meter-heading">
          <h3 id="rf-ats-meter-heading">Resume readiness</h3>
          <span className="rf-ats-status">
            {preview
              ? "Unsaved preview"
              : loading || busy
                ? "Checking…"
                : !evaluation
                  ? "Not evaluated"
                  : stale
                    ? "Needs recheck"
                    : "Evaluated"}
          </span>
        </div>
        <div
          className="rf-ats-score-value"
          aria-label={
            result
              ? `Resume readiness ${String(result.score)} out of 100${preview ? ", unsaved preview" : stale ? ", outdated" : ""}`
              : "Readiness not evaluated"
          }
        >
          <span>{result?.score ?? "—"}</span>
          <span> / 100</span>
        </div>
        <div
          className="rf-ats-scale"
          role="img"
          aria-label={
            result
              ? `Internal readiness score ${String(result.score)} out of 100`
              : "Readiness scale, not evaluated"
          }
        >
          <div className="rf-ats-track">
            {result ? (
              <span
                className="rf-readiness-fill"
                style={{ width: `${String(result.score)}%` }}
              />
            ) : null}
          </div>
          <div className="rf-ats-ticks" aria-hidden="true">
            {[0, 25, 50, 75, 100].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <p>General readiness · no JD needed.</p>
        <details className="rf-assessment-details">
          <summary>Score breakdown & details</summary>
          <p>
            Internal content checks; not an employer ATS rating or PDF parsing
            test.
          </p>
          {preview ? (
            <p>Unsaved preview. Save changes to store a new assessment.</p>
          ) : evaluation ? (
            <p>
              Saved version {evaluation.resumeVersion} ·{" "}
              {evaluation.rubricVersion}
              <br />
              Checked {new Date(evaluation.evaluatedAt).toLocaleString()}
            </p>
          ) : (
            <p>Saved resumes are checked automatically.</p>
          )}
          {result ? (
            <section
              aria-label="Readiness breakdown"
              className="rf-readiness-components"
            >
              {result.components.map((c) => (
                <div key={c.id}>
                  <span>
                    {c.label}
                    <small>
                      {c.weight}% weight · {c.passed}/{c.total} checks
                    </small>
                  </span>
                  <strong>{c.score}/100</strong>
                </div>
              ))}
            </section>
          ) : null}
        </details>
        {stale && !preview ? (
          <p role="status">
            This assessment belongs to an older saved version or rule set. It remains
            visible until the latest check succeeds.
          </p>
        ) : null}
        {disabledReason && !preview ? (
          <p role="status">{disabledReason}</p>
        ) : null}
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <Button
              size="sm"
              variant="outline"
              disabled={blocked}
              onClick={() => {
                setRetry((n) => n + 1);
              }}
            >
              Retry readiness check
            </Button>
          </div>
        ) : null}
        {evaluation && !error ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={blocked}
            aria-busy={busy || loading}
            onClick={() => {
              if (run) void mutate(run);
            }}
          >
            Recheck readiness
          </Button>
        ) : null}
      </section>
      {result ? (
        <>
          {result.truncated ? (
            <p role="status">
              Showing the first 100 checks. The score uses all checks.
            </p>
          ) : null}
          <AssessmentFeedback
            mode="rules"
            label={label}
            checks={result.checks}
            dismissed={state?.dismissed ?? []}
            disabled={navigationDisabled || (!preview && (blocked || stale))}
            onTarget={onTarget}
            onDismiss={
              dismiss && evaluation && !preview && !stale && !blocked
                ? (check, hidden) => {
                    void mutate(() => dismiss(evaluation.id, check.id, hidden));
                  }
                : undefined
            }
          />
        </>
      ) : (
        <div className="rf-panel-empty" role="status">
          <strong>
            {loading ? "Checking your resume" : "No saved assessment"}
          </strong>
          <p>Save your resume to get a versioned assessment.</p>
        </div>
      )}
    </div>
  );
}
