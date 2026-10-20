import { useEffect, useRef, useState } from "react";
import {
  AssessmentMeter,
  Button,
  DocumentStatus,
  RequestFeedback,
} from "@resume-forge/shared";
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
  reducedMotion?: boolean;
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
  reducedMotion,
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
      state.currentVersion !== savedVersion ||
      evaluation.rubricVersion !== READINESS_RUBRIC);
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
      {loading || busy ? (
        <RequestFeedback
          label="Checking resume"
          reducedMotion={reducedMotion}
        />
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
            disabled={busy || loading}
            onClick={() => { setRetry((value) => value + 1); }}
          >
            Retry resume check
          </Button>
        </div>
      ) : null}
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
      ) : !loading && !error ? (
        <p role="status">
          Saved resumes are checked automatically. Add your experience to see
          useful feedback.
        </p>
      ) : null}
      <details className="rf-readiness-summary">
        <summary>
          Resume check details
          {result?.score != null ? ` · ${String(result.score)}/100` : ""}
        </summary>
        <section className="rf-ats-readiness" aria-label="Resume checks">
          <DocumentStatus
            tone={
              preview || loading || busy || stale
                ? "pending"
                : evaluation
                  ? "saved"
                  : "neutral"
            }
          >
            {preview
              ? "Unsaved preview"
              : loading || busy
                ? "Checking…"
                : !evaluation
                  ? "Not evaluated"
                  : stale
                    ? "Needs recheck"
                    : "Evaluated"}
          </DocumentStatus>
          <AssessmentMeter
            value={result?.score}
            label="General resume readiness"
          />
          <p>
            Content checks, not an employer ATS rating or PDF parsing test. Job
            fit is checked separately.
          </p>
          {preview ? (
            <p>Unsaved preview. Save changes to store a new assessment.</p>
          ) : evaluation ? (
            <p>
              Saved version {evaluation.resumeVersion}. Checked{" "}
              {new Date(evaluation.evaluatedAt).toLocaleString()}.
            </p>
          ) : null}
          {stale && !preview ? (
            <p role="status">
              These checks belong to an older saved version or rule set. Recheck
              before relying on them.
            </p>
          ) : null}
          {result ? (
            <div
              aria-label="Readiness breakdown"
              className="rf-readiness-components"
            >
              {result.components.map((component) => (
                <div key={component.id}>
                  <span>
                    {component.label}
                    <small>
                      {component.weight}% weight · {component.passed}/
                      {component.total} checks
                    </small>
                  </span>
                  <strong>{component.score}/100</strong>
                </div>
              ))}
            </div>
          ) : null}
          {run ? (
            <Button
              size="sm"
              variant="outline"
              disabled={blocked}
              aria-busy={busy || loading}
              onClick={() => void mutate(run)}
            >
              Recheck resume
            </Button>
          ) : null}
        </section>
      </details>
    </div>
  );
}
