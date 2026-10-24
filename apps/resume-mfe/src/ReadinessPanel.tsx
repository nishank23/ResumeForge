import { useEffect, useRef, useState } from "react";
import {
  AssessmentMeter,
  Button,
  DocumentStatus,
  RequestFeedback,
} from "@resume-forge/shared";
import type { ReadinessResult } from "@resume-forge/resume-core";
import type { ReadinessState } from "@resume-forge/shared-types";
import { READINESS_RUBRIC } from "@resume-forge/resume-core";
import { needsReadinessCheck } from "./readiness-feedback";
export interface ReadinessPanelProps {
  savedVersion: number;
  reducedMotion?: boolean;
  disabledReason?: string;
  preview?: ReadinessResult;
  load?: (signal?: AbortSignal) => Promise<ReadinessState>;
  run?: () => Promise<ReadinessState>;
  dismiss?: (
    evaluationId: string,
    issueId: string,
    dismissed: boolean,
  ) => Promise<ReadinessState>;
}
export function ReadinessPanel({
  savedVersion,
  reducedMotion,
  disabledReason,
  preview,
  load,
  run,
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
            onClick={() => {
              setRetry((value) => value + 1);
            }}
          >
            Retry resume check
          </Button>
        </div>
      ) : null}
      <section
        className="rf-ats-readiness rf-compact-score"
        aria-label="Resume score"
      >
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
        <AssessmentMeter value={result?.score} label="Resume score" />
        <p>
          Internal content score. Use Job fit to compare with a job description.
        </p>
        {preview ? (
          <p role="status">Save your changes to update the saved score.</p>
        ) : null}
        {stale && !preview ? (
          <p role="status">
            This score belongs to an older version. Recheck to update it.
          </p>
        ) : null}
        {!result && !loading && !error ? (
          <p role="status">Save your resume to get a score.</p>
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
    </div>
  );
}
