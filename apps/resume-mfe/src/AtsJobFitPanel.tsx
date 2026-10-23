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
  onWrite,
}: {
  services?: AtsJobFitServices;
  savedVersion: number;
  disabledReason?: string;
  reducedMotion?: boolean;
  onTailor?: (jd: string) => void;
  onWrite?: () => void;
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
  const editedRef = useRef(false);
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
            if (!editedRef.current && value.evaluation?.jdText) {
              setText(value.evaluation.jdText);
              setSubmittedText(value.evaluation.jdText);
              setEdited(false);
            }
            setEditingJd(!value.evaluation?.jdText);
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
        editedRef.current = false;
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
  const improvements =
    result?.requirements
      .filter((item) => item.status !== "supported")
      .sort(
        (a, b) =>
          Number(b.importance === "required") -
          Number(a.importance === "required"),
      ) ?? [];
  return (
    <div className="rf-service-tools rf-ats-job-fit">
      <section
        className={`rf-ats-overview${result ? " rf-ats-result" : ""}`}
        aria-label={result ? "Job fit result" : "ATS assessment"}
      >
        <div className="rf-ats-score-card">
          <div className="rf-ats-score-heading">
            <h3>ATS score</h3>
            {result ? (
              <DocumentStatus tone="saved">
                Version {evaluation?.resumeVersion}
              </DocumentStatus>
            ) : (
              <span>Job fit</span>
            )}
          </div>
          <AssessmentMeter
            value={result?.score}
            label="ATS score · job fit evidence coverage"
          />
          {result ? (
            result.score === null ? (
              <p>
                No clear job requirements found. Try a more complete job
                description.
              </p>
            ) : (
              <>
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
                  Job fit evidence coverage. ATS decisions vary.
                </p>
              </>
            )
          ) : (
            <p>
              {loading
                ? "Loading your saved assessment…"
                : busy
                  ? "Checking this job against your saved resume…"
                  : stale
                    ? "Resume or job description changed. Save your resume and check job fit again."
                    : error
                      ? "Assessment unavailable. Retry below."
                      : "Add a job description to see your score and what to improve."}
            </p>
          )}
        </div>
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
        <section
          className="rf-ats-job-context"
          aria-label="Job-based improvement"
        >
          {editingJd || !evaluation || stale || savedJobNeedsText ? (
            <>
              <label className="rf-ats-jd-label" htmlFor="rf-ats-jd">
                Job description
              </label>
              <textarea
                id="rf-ats-jd"
                className="rf-ats-jd-input"
                value={text}
                maxLength={12000}
                rows={4}
                disabled={busy}
                placeholder="Paste the role you’re applying for"
                onChange={(event) => {
                  editedRef.current = true;
                  setText(event.target.value);
                  setEdited(true);
                }}
              />
              <p className="rf-tool-hint" id="rf-ats-consent">
                Uses Gemini and saved professional facts, excluding contacts.
                The JD is kept privately for reuse.
              </p>
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
                    editedRef.current = true;
                    setText("");
                    setEdited(true);
                  }}
                >
                  Clear
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="rf-ats-job-excerpt">{text}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingJd(true);
                }}
              >
                Change job description
              </Button>
            </>
          )}
          {savedJobNeedsText ? (
            <p className="rf-tool-hint">
              This older assessment has no saved JD. Paste the job description
              again to check or tailor this role.
            </p>
          ) : null}
          {disabledReason ? (
            <p role="status">{disabledReason}</p>
          ) : !savedVersion ? (
            <p role="status">Save this resume before checking job fit.</p>
          ) : null}
          {onTailor ? (
            <Button
              size="sm"
              variant={result ? "default" : "outline"}
              disabled={blocked}
              onClick={() => {
                onTailor(text.trim());
              }}
            >
              Tailor for this job
            </Button>
          ) : null}
        </section>
        {result ? (
          <>
            <section
              className="rf-ats-next-steps"
              aria-label="Ways to improve ATS score"
            >
              <h3>
                {improvements.length
                  ? "How to improve"
                  : "Requirements covered"}
              </h3>
              {improvements.length ? (
                <>
                  <p>Add only experience you actually have.</p>
                  <ul>
                    {improvements.slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <strong>{item.requirement}</strong>
                        <span>
                          {item.importance === "required"
                            ? "Required"
                            : "Preferred"}{" "}
                          ·{" "}
                          {item.status === "missing"
                            ? "Missing evidence"
                            : "Uncertain"}
                        </span>
                        <p>
                          {item.status === "missing"
                            ? "If you have this experience, add a concrete example to your resume."
                            : "Clarify your relevant work, dates or qualifications so the evidence is explicit."}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {improvements.length > 3 ? (
                    <p>
                      {improvements.length - 3} more in requirements and
                      evidence below.
                    </p>
                  ) : null}
                </>
              ) : (
                <p>
                  Your resume supports the extracted requirements. Review
                  wording with hover Improve with AI, or tailor it to this role.
                </p>
              )}
              {onWrite ? (
                <Button size="sm" variant="outline" onClick={onWrite}>
                  Edit resume
                </Button>
              ) : null}
            </section>
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
          </>
        ) : null}
      </section>
    </div>
  );
}
