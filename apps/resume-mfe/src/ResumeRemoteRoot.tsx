import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import {
  Button,
  useSession,
  type ShellFederationContext,
} from "@resume-forge/shared";
import { ManualResumeEditor } from "./ManualResumeEditor";
import { ResumeLibrary } from "./ResumeLibrary";
import {
  blankResume,
  createResumeApi,
  fromResumeContent,
  type SavedResume,
} from "./resume-api";
import type { ResumeDraft } from "./editor-draft";
import "./resume-library.css";
export interface ResumeRemoteRootProps {
  readonly context?: ShellFederationContext;
  readonly view?: "library" | "create" | "editor" | "upload";
  readonly resumeId?: string;
}
export function ResumeRemoteRoot({
  context,
  view = "library",
  resumeId,
}: ResumeRemoteRootProps) {
  const { requestApi, state } = useSession();
  const workspaceId = context?.activeWorkspace.id ?? "";
  const api = useMemo(
    () => createResumeApi(requestApi, workspaceId),
    [requestApi, workspaceId],
  );
  const [saved, setSaved] = useState<SavedResume | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [retry, setRetry] = useState(0);
  const [staged, setStaged] = useState<{
      draft: ResumeDraft;
      text: string;
    } | null>(null),
    [fileName, setFileName] = useState("");
  const createId = useRef(crypto.randomUUID()),
    busy = useRef(false);
  const back = () => context?.onNavigate?.(`/w/${workspaceId}/resumes`);
  useEffect(() => {
    if (view !== "editor" || !resumeId) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    api
      .load(resumeId, abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) setSaved(data);
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load resume.");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => {
      abort.abort();
    };
  }, [api, view, resumeId, retry]);
  if (!context)
    return (
      <div className="rf-page rf-empty">
        <h1>Your resume workspace</h1>
        <p>Sign in to load and save your own resumes.</p>
        <a className="rf-primary-link" href="http://localhost:3000/">
          Open workspace
        </a>
      </div>
    );
  if (view === "library") return <ResumeLibrary context={context} />;
  if (view === "editor") {
    if (loading)
      return (
        <div className="rf-page" role="status">
          Loading your resume…
        </div>
      );
    if (!saved)
      return (
        <div className="rf-page rf-empty">
          <h1>Resume unavailable</h1>
          <p role="alert">{error}</p>
          <Button
            onClick={() => {
              setRetry((v) => v + 1);
            }}
          >
            Retry
          </Button>
          <Button variant="outline" onClick={back}>
            My resumes
          </Button>
        </div>
      );
    return (
      <>
        {typeof saved.content.rawText === "string" && saved.content.rawText && (
          <div className="rf-import-review">
            <details>
              <summary>View saved extracted text</summary>
              <textarea
                aria-label="Saved extracted resume text"
                readOnly
                value={saved.content.rawText}
              />
              <p>
                This is the original text reference. Your saved edits appear in
                the document below.
              </p>
            </details>
          </div>
        )}
        <ManualResumeEditor
          key={saved.id}
          context={context}
          initialDraft={fromResumeContent(saved.content)}
          savedVersion={saved.currentVersion}
          onSave={async (draft) => {
            const next = await api.save(
              saved.id,
              saved.currentVersion,
              draft,
              typeof saved.content.rawText === "string"
                ? saved.content.rawText
                : undefined,
            );
            setSaved(next);
            return next.currentVersion;
          }}
        />
      </>
    );
  }
  if (staged)
    return (
      <>
        <div className="rf-import-review">
          <h1>Review your imported resume</h1>
          <p>
            {fileName} is ready for review. Check names, dates and section
            mapping. Save creates a new resume in your account.
          </p>
          <details>
            <summary>Review the extracted text</summary>
            <textarea
              aria-label="Extracted resume text"
              readOnly
              value={staged.text}
            />
            <p>
              Keep this reference open while correcting the document below.
              Original layout is not preserved.
            </p>
          </details>
        </div>
        <ManualResumeEditor
          key={createId.current}
          context={context}
          initialDraft={staged.draft}
          savedVersion={0}
          onSave={async (draft) => {
            const next = await api.create(createId.current, draft, staged.text);
            context.onNavigate?.(`/w/${workspaceId}/resumes/${next.id}`);
            return next.currentVersion;
          }}
          saveLabel="Confirm and save resume"
        />
      </>
    );
  return (
    <div
      className="rf-page"
      data-remote-module="resume_mfe"
      data-react-version={React.version}
    >
      <button className="rf-back" onClick={back}>
        <ArrowLeft size={16} /> My resumes
      </button>
      <div className="rf-page-heading">
        <h1>
          {view === "upload" ? "Bring your resume." : "Start a new resume."}
        </h1>
        <p>
          {view === "upload"
            ? "Your experience, ready to edit."
            : "A blank page with room for your experience."}
        </p>
      </div>
      <section className="rf-upload-panel">
        <h2>
          {view === "upload" ? "Upload your resume" : "Create a blank resume"}
        </h2>
        <p>
          No profile setup needed. Your account name can fill the header;
          professional details come from you.
        </p>
        {view === "upload" ? (
          <>
            <label className="rf-upload-choice">
              <Upload size={24} />
              <input
                aria-label="Choose resume file"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                disabled={loading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || busy.current) return;
                  busy.current = true;
                  setLoading(true);
                  setError("");
                  setFileName(file.name);
                  void api
                    .parse(file)
                    .then(setStaged)
                    .catch((e: unknown) => {
                      setError(
                        e instanceof Error ? e.message : "Could not read file.",
                      );
                    })
                    .finally(() => {
                      busy.current = false;
                      setLoading(false);
                    });
                }}
              />
            </label>
            <p>
              Text-based PDF, DOCX, TXT or Markdown. Up to 10 MB. Processed
              locally; review before saving. Scanned or encrypted PDFs need a
              text-based copy.
            </p>
          </>
        ) : (
          <Button
            disabled={loading}
            onClick={() => {
              if (busy.current) return;
              busy.current = true;
              setLoading(true);
              void api
                .create(
                  createId.current,
                  blankResume(
                    state.status === "authenticated"
                      ? (state.identity.name ?? "")
                      : "",
                  ),
                )
                .then((next) =>
                  context.onNavigate?.(`/w/${workspaceId}/resumes/${next.id}`),
                )
                .catch((e: unknown) => {
                  setError(
                    e instanceof Error ? e.message : "Could not create resume.",
                  );
                })
                .finally(() => {
                  busy.current = false;
                  setLoading(false);
                });
            }}
          >
            Create resume
          </Button>
        )}
        {loading ? (
          <p role="status">
            {view === "upload"
              ? "Reading your resume…"
              : "Creating your resume…"}
          </p>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
export default ResumeRemoteRoot;
