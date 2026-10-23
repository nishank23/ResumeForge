import { useEffect, useRef, useState } from "react";
import {
  AssessmentMeter,
  Button,
  DocumentStatus,
  RequestFeedback,
} from "@resume-forge/shared";
import type { AtsAssessmentState } from "./resume-api";

export interface AtsJobFitServices {
  load: (signal?: AbortSignal) => Promise<AtsAssessmentState>;
  run: (jdText: string) => Promise<AtsAssessmentState>;
}

/** Load saved evidence freely; request a paid assessment only after an explicit click. */
export function AtsJobFitPanel({
  services,
  savedVersion,
  disabledReason,
  reducedMotion,
  onTailor,
}: {
  services?: AtsJobFitServices;
  savedVersion: number;
  disabledReason?: string;
  reducedMotion?: boolean;
  onTailor?: (jd: string) => void;
}) {
  const [state, setState] = useState<AtsAssessmentState | null>(null);
  const [text, setText] = useState("");
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [editingJd, setEditingJd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const identity = useRef(0);
  const running = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    const id = ++identity.current;
    setBusy(false);
    running.current = false;
    setError("");
    setState(null);
    if (services && savedVersion > 0) {
      setLoading(true);
      void services
        .load(abort.signal)
        .then((value) => {
          if (!abort.signal.aborted && id === identity.current) {
            setState(value);
            setEditingJd(!value.evaluation);
          }
        })
        .catch((reason: unknown) => {
          if (!abort.signal.aborted && id === identity.current)
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load saved job fit. Retry.",
            );
        })
        .finally(() => {
          if (!abort.signal.aborted && id === identity.current)
            setLoading(false);
        });
    } else setLoading(false);
    return () => {
      abort.abort();
      identity.current = id + 1;
    };
  }, [services, savedVersion, retry]);
  const evaluation = state?.evaluation;
  const jdChanged =
    submittedText === null ? edited : text.trim() !== submittedText;
  const stale =
    !!evaluation &&
    (evaluation.resumeVersion !== savedVersion ||
      state.currentVersion !== savedVersion ||
      jdChanged ||
      !!disabledReason);
  const result =
    evaluation && !stale && !busy && !loading && !error
      ? evaluation.assessment
      : null;
  const primaryCoverage = result?.coverage.required.total
    ? result.coverage.required
    : result?.coverage.preferred;
  const primaryImportance = result?.coverage.required.total
    ? "required"
    : "preferred";
  const savedJobNeedsText = !!evaluation && !text.trim();
  const blocked =
    busy ||
    loading ||
    !!disabledReason ||
    !savedVersion ||
    !services ||
    text.trim().length < 50;
  const run = async () => {
    if (blocked || running.current) return;
    running.current = true;
    const id = identity.current;
    const jd = text.trim();
    setBusy(true);
    setError("");
    try {
      const value = await services.run(jd);
      if (id === identity.current) {
        setState(value);
        setSubmittedText(jd);
        setEdited(false);
        setEditingJd(false);
      }
    } catch (reason) {
      if (id === identity.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Job fit failed. Your resume is unchanged. Retry.",
        );
    } finally {
      if (id === identity.current) {
        setBusy(false);
        running.current = false;
      }
    }
  };
  return (
    <div className="rf-service-tools rf-ats-job-fit">
      <p className="rf-tool-hint">
        Compare your saved resume with the requirements of one job.
      </p>
      {editingJd || !evaluation || stale ? (
        <>
          <label className="rf-ats-jd-label" htmlFor="rf-ats-jd">
            Job description
          </label>
          <textarea
            id="rf-ats-jd"
            className="rf-ats-jd-input"
            value={text}
            maxLength={12000}
            rows={7}
            disabled={busy}
            placeholder="Paste responsibilities and qualifications"
            onChange={(event) => {
              setText(event.target.value);
              setEdited(true);
            }}
          />
          <p className="rf-tool-hint" id="rf-ats-consent">
            Check job fit sends this JD and visible professional facts from your
            saved resume to Gemini. Contacts are excluded.
          </p>
          {disabledReason ? (
            <p role="status">{disabledReason}</p>
          ) : !savedVersion ? (
            <p role="status">Save this resume before checking job fit.</p>
          ) : null}
          <div className="rf-ats-job-actions">
            <Button
              size="sm"
              disabled={blocked}
              aria-busy={busy}
              aria-describedby="rf-ats-consent"
              onClick={() => void run()}
            >
              Check job fit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || !text}
              onClick={() => {
                setText("");
                setEdited(true);
              }}
            >
              Clear
            </Button>
          </div>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingJd(true);
            if (!text.trim()) setEdited(true);
          }}
        >
          Change job description
        </Button>
      )}
      {savedJobNeedsText ? (
        <p className="rf-tool-hint">
          Job descriptions are not stored. Paste the job description again to
          check or tailor this role.
        </p>
      ) : null}
      {busy || loading ? (
        <RequestFeedback
          label={busy ? "Checking job fit" : "Loading saved job fit"}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {error ? (
        <div role="alert">
          <p>{error}</p>
          {!busy && !loading ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRetry((value) => value + 1);
              }}
            >
              Reload saved job fit
            </Button>
          ) : null}
        </div>
      ) : null}
      {stale ? (
        <p role="status">
          Resume or job description changed. Save your resume and check job fit
          again.
        </p>
      ) : null}
      {result ? (
        <section className="rf-ats-result" aria-label="Job fit result">
          <DocumentStatus tone="saved">
            Saved version {evaluation?.resumeVersion}
          </DocumentStatus>
          {result.score === null ? (
            <p>
              No clear job requirements found. Try a more complete job
              description.
            </p>
          ) : (
            <>
              <AssessmentMeter
                value={result.score}
                label="Job fit evidence coverage"
              />
              <p>
                {primaryCoverage?.supported} of {primaryCoverage?.total}{" "}
                {primaryImportance} requirements supported.
              </p>
              {result.coverage.required.total &&
              result.coverage.preferred.total ? (
                <p>
                  {result.coverage.preferred.supported} of{" "}
                  {result.coverage.preferred.total} preferred requirements
                  supported.
                </p>
              ) : null}
              <p className="rf-tool-hint">
                Evidence coverage, not a guarantee of ATS acceptance or an
                interview.
              </p>
            </>
          )}
          <details className="rf-assessment-details">
            <summary>View requirements and evidence</summary>
            {result.requirements.map((requirement) => (
              <section key={requirement.id} className="rf-ats-requirement">
                <p>
                  <strong>
                    {requirement.status === "supported"
                      ? "Supported"
                      : requirement.status === "missing"
                        ? "Missing evidence"
                        : "Uncertain"}
                  </strong>{" "}
                  · {requirement.importance}
                </p>
                <h3>{requirement.requirement}</h3>
                <p>
                  Job description: <q>{requirement.jdQuote}</q>
                </p>
                {requirement.evidence.map((item, index) => (
                  <blockquote key={`${item.sourceId}-${String(index)}`}>
                    <p>{item.quote}</p>
                    <cite>Saved resume evidence</cite>
                  </blockquote>
                ))}
              </section>
            ))}
            {result.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
            <p className="rf-tool-hint">
              {result.rubricVersion} · {result.model}
            </p>
          </details>
        </section>
      ) : !loading && !busy && !stale ? (
        <p className="rf-tool-hint">
          No job fit score until you check a job description.
        </p>
      ) : null}
      {onTailor ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !!disabledReason || text.trim().length < 50}
          onClick={() => {
            onTailor(text);
          }}
        >
          Tailor for this job
        </Button>
      ) : null}
    </div>
  );
}
