import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
} from "lucide-react";
import {
  Button,
  Dialog,
  DocumentStatus,
  RequestFeedback,
} from "@resume-forge/shared";
import type {
  ReadabilityState,
  ReadabilityAnalysis,
} from "@resume-forge/shared-types";
import "./resume-readability.css";

export interface ReadabilityServices {
  load: (signal?: AbortSignal) => Promise<ReadabilityState>;
  run: (signal?: AbortSignal) => Promise<ReadabilityState>;
}
const issueTitle = (issue: ReadabilityAnalysis["issues"][number]) =>
  issue.kind === "missing_text"
    ? "Text not recovered"
    : issue.kind === "reading_order"
      ? "Check reading order"
      : "No readable text";
function ReadabilityIssue({
  issue,
}: {
  issue: ReadabilityAnalysis["issues"][number];
}) {
  return (
    <li className="rf-readability-issue">
      <strong>{issueTitle(issue)}</strong>
      <span>{issue.label}</span>
      {issue.excerpts[0] ? (
        <p>{issue.excerpts[0]}</p>
      ) : (
        <p>Add visible text to your resume, then save and check again.</p>
      )}
    </li>
  );
}
/** Only GET on mount. PDF work starts after the user's explicit action. */
export function ResumeReadabilityPanel({
  services,
  savedVersion,
  dirty,
  disabledReason,
  saving,
  reducedMotion,
  onSave,
  onWrite,
  onDesign,
}: {
  services?: ReadabilityServices;
  savedVersion: number;
  dirty: boolean;
  disabledReason?: string;
  saving: boolean;
  reducedMotion?: boolean;
  onSave: () => void;
  onWrite: () => void;
  onDesign: () => void;
}) {
  const [state, setState] = useState<ReadabilityState | null>(null);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState(false),
    [page, setPage] = useState(0);
  const identity = useRef(0),
    running = useRef(false),
    requestAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    const id = ++identity.current,
      abort = new AbortController();
    requestAbort.current?.abort();
    running.current = false;
    setBusy(false);
    setState(null);
    setError("");
    setPreview(false);
    setPage(0);
    if (!services || !savedVersion) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void services
      .load(abort.signal)
      .then((value) => {
        if (id === identity.current && !abort.signal.aborted) setState(value);
      })
      .catch((reason: unknown) => {
        if (id === identity.current && !abort.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load your PDF check. Retry.",
          );
      })
      .finally(() => {
        if (id === identity.current && !abort.signal.aborted) setLoading(false);
      });
    return () => {
      abort.abort();
      requestAbort.current?.abort();
      identity.current = id + 1;
    };
  }, [services, savedVersion]);
  const evaluation = state?.evaluation;
  const fresh =
    evaluation &&
    evaluation.resumeVersion === savedVersion &&
    state.currentVersion === savedVersion &&
    !dirty &&
    !error &&
    !busy &&
    !loading;
  const analysis = fresh ? evaluation.analysis : null;
  const blocked = busy || loading || saving || !!disabledReason;
  const run = async () => {
    if (blocked || dirty || !services || !savedVersion || running.current)
      return;
    running.current = true;
    const id = identity.current,
      abort = new AbortController();
    requestAbort.current = abort;
    setBusy(true);
    setError("");
    setPreview(false);
    try {
      const value = await services.run(abort.signal);
      if (id === identity.current && !abort.signal.aborted) {
        setState(value);
        setPage(0);
      }
    } catch (reason) {
      if (id === identity.current && !abort.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not check the PDF. Your resume is unchanged. Retry.",
        );
    } finally {
      if (id === identity.current) {
        setBusy(false);
        running.current = false;
      }
    }
  };
  return (
    <div className="rf-readability-panel" data-ui="">
      <div className="rf-readability-intro">
        <FileText size={22} aria-hidden="true" />
        <div>
          <h3>Can your PDF be read?</h3>
          <p>No job description needed. Checks your saved PDF without AI.</p>
        </div>
      </div>
      {analysis && evaluation ? (
        <section
          className="rf-readability-result"
          aria-label="PDF readability result"
          data-status={analysis.status}
        >
          <div className="rf-readability-result-heading">
            {analysis.status === "readable" ? (
              <CheckCircle2 size={22} aria-hidden="true" />
            ) : (
              <CircleAlert size={22} aria-hidden="true" />
            )}
            <h3>
              {analysis.status === "readable"
                ? "Text recovered in order"
                : `${String(analysis.issues.length)} ${analysis.issues.length === 1 ? "issue" : "issues"} to review`}
            </h3>
          </div>
          <DocumentStatus tone="saved">
            Saved version {evaluation.resumeVersion} · {analysis.pages.length}{" "}
            {analysis.pages.length === 1 ? "page" : "pages"}
          </DocumentStatus>
          {analysis.status === "readable" ? (
            <p>All visible saved text was recovered in the expected order.</p>
          ) : (
            <>
              <p>
                Compare these parts with the extracted text before sharing your
                PDF.
              </p>
              <ul>
                {analysis.issues.slice(0, 3).map((issue, i) => (
                  <ReadabilityIssue key={i} issue={issue} />
                ))}
              </ul>
              {analysis.issues.length > 3 ? (
                <p>{analysis.issues.length - 3} more in the text preview.</p>
              ) : null}
            </>
          )}
          <Button
            size="sm"
            onClick={() => {
              setPage(0);
              setPreview(true);
            }}
          >
            View extracted text
          </Button>
          {analysis.issues.length ? (
            <Button
              size="sm"
              variant="outline"
              onClick={
                analysis.issues.every((issue) => issue.kind === "reading_order")
                  ? onDesign
                  : onWrite
              }
            >
              {analysis.issues.every((issue) => issue.kind === "reading_order")
                ? "Review layout"
                : "Edit resume"}
            </Button>
          ) : null}
        </section>
      ) : !busy && !loading && !error ? (
        <p className="rf-readability-empty">
          {dirty
            ? "Save your changes, then check the PDF for this version."
            : !savedVersion
              ? "Save your resume first. Then check text extraction and reading order."
              : evaluation
                ? "Your saved version changed. Reopen the latest resume to check it."
                : "Find text lost in export or a reading order that needs a closer look."}
        </p>
      ) : null}
      {loading || busy ? (
        <RequestFeedback
          label={busy ? "Checking your PDF" : "Loading your saved PDF check"}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {error ? (
        <p role="alert" className="rf-readability-error">
          {error}
        </p>
      ) : null}
      {disabledReason ? <p role="status">{disabledReason}</p> : null}
      {dirty || !savedVersion ? (
        <Button size="sm" disabled={blocked} onClick={onSave}>
          {saving ? "Saving…" : savedVersion ? "Save changes" : "Save resume"}
        </Button>
      ) : (
        <Button
          size="sm"
          variant={analysis ? "ghost" : "default"}
          disabled={blocked || !services}
          aria-busy={busy}
          onClick={() => void run()}
        >
          {busy
            ? "Checking PDF…"
            : error
              ? "Retry readability check"
              : analysis
                ? "Check again"
                : "Check readability"}
        </Button>
      )}
      <p className="rf-readability-limit">
        Tests our parser’s extraction, not writing quality or guaranteed
        acceptance by every ATS.
      </p>
      {preview && analysis && evaluation ? (
        <Dialog
          open
          title="Extracted PDF text"
          description={`Saved version ${String(evaluation.resumeVersion)}. This is the text recovered from your PDF.`}
          onOpenChange={setPreview}
          className="rf-readability-dialog"
          bodyClassName="rf-readability-dialog-body"
          footer={
            <Button variant="outline" onClick={() => { setPreview(false); }}>
              Back to improvements
            </Button>
          }
        >
          {analysis.issues.length ? (
            <details className="rf-readability-all-issues">
              <summary>
                {analysis.issues.length}{" "}
                {analysis.issues.length === 1 ? "issue" : "issues"} to review
              </summary>
              <ul>
                {analysis.issues.map((issue, i) => (
                  <ReadabilityIssue key={i} issue={issue} />
                ))}
              </ul>
            </details>
          ) : null}
          <div
            className="rf-readability-pager"
            aria-label="Extracted text pages"
          >
            <Button
              size="icon"
              variant="ghost"
              aria-label="Previous extracted page"
              disabled={page === 0}
              onClick={() => { setPage((value) => value - 1); }}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </Button>
            <span role="status">
              Page {page + 1} of {analysis.pages.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Next extracted page"
              disabled={page === analysis.pages.length - 1}
              onClick={() => { setPage((value) => value + 1); }}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
          </div>
          <div
            className="rf-readability-extracted"
            tabIndex={0}
            aria-label={`Extracted text, page ${String(page + 1)}`}
          >
            {analysis.pages[page]?.text || "No text recovered on this page."}
          </div>
          <p className="rf-readability-limit">
            Visible text only. Link destinations and hidden document data are
            not added to this preview.
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}
