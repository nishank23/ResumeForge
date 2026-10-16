import type {
  RewriteTarget,
  RewriteProposal,
  TailoringFact,
} from "@resume-forge/shared-types";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Button,
  AsciiSpotlight,
  RequestFeedback,
  StudioLoading,
  useSession,
  type ShellFederationContext,
} from "@resume-forge/shared";
import { RESUME_UI_FEATURES } from "./ui-features";
import { ManualResumeEditor } from "./ManualResumeEditor";
import { ResumeLibrary } from "./ResumeLibrary";
import {
  blankResume,
  createResumeApi,
  fromResumeContent,
  type SavedResume,
} from "./resume-api";
import { downloadResumePdf } from "./download-resume";
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
    [loading, setLoading] = useState(view === "editor" && !!resumeId),
    [retry, setRetry] = useState(0);
  const readinessId = saved?.id,
    readinessVersion = saved?.currentVersion;
  const readiness = useMemo(
    () =>
      readinessId && readinessVersion
        ? {
            load: (signal?: AbortSignal) => api.readiness(readinessId, signal),
            run: () => api.runReadiness(readinessId, readinessVersion),
            dismiss: (
              evaluationId: string,
              issueId: string,
              dismissed: boolean,
            ) =>
              api.setReadinessDismissed(
                readinessId,
                readinessVersion,
                evaluationId,
                issueId,
                dismissed,
              ),
          }
        : undefined,
    [api, readinessId, readinessVersion],
  );
  const jdMatch = useMemo(
    () =>
      readinessId && readinessVersion
        ? {
            load: (signal?: AbortSignal) => api.jdMatch(readinessId, signal),
            tailoring: {
              load: (signal?: AbortSignal) =>
                api.tailoring(readinessId, signal),
              analyze: (text: string) =>
                api.runJdMatch(
                  readinessId,
                  readinessVersion,
                  text,
                  false,
                  false,
                ),
              start: (id: string, text: string, facts: TailoringFact[]) =>
                api.startTailoring(
                  readinessId,
                  readinessVersion,
                  id,
                  text,
                  facts,
                ),
              cancel: (id: string) => api.cancelTailoring(readinessId, id),
              apply: (id: string, selected: string[], title: string) =>
                api.applyTailoring(
                  readinessId,
                  readinessVersion,
                  id,
                  selected,
                  title,
                ),
              openCopy: (id: string) =>
                context?.onNavigate?.(`/w/${workspaceId}/resumes/${id}`),
            },
            run: (text: string, semantic: boolean, consent: boolean) =>
              api.runJdMatch(
                readinessId,
                readinessVersion,
                text,
                semantic,
                consent,
              ),
            dismiss: (
              evaluationId: string,
              issueId: string,
              dismissed: boolean,
            ) =>
              api.dismissJd(
                readinessId,
                readinessVersion,
                evaluationId,
                issueId,
                dismissed,
              ),
          }
        : undefined,
    [api, readinessId, readinessVersion, context, workspaceId],
  );
  const rewrite = useMemo(
    () =>
      readinessId && readinessVersion
        ? {
            request: (target: RewriteTarget) =>
              api.requestRewrite(readinessId, readinessVersion, target, true),
            apply: async (proposal: RewriteProposal) => {
              const next = await api.applyRewrite(
                readinessId,
                readinessVersion,
                proposal.id,
              );
              setSaved((previous) =>
                previous?.id === readinessId
                  ? {
                      ...previous,
                      content: next.content,
                      currentVersion: next.currentVersion,
                    }
                  : previous,
              );
              return next.draft;
            },
          }
        : undefined,
    [api, readinessId, readinessVersion],
  );
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
  if (view === "library" || view === "upload")
    return (
      <ResumeLibrary context={context} initialUploadOpen={view === "upload"} />
    );
  if (view === "editor") {
    if (loading) return <StudioLoading reducedMotion={context.reducedMotion} />;
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
        {RESUME_UI_FEATURES.showExtractedText &&
          typeof saved.content.rawText === "string" &&
          saved.content.rawText && (
            <div className="rf-import-review">
              <details>
                <summary>View saved extracted text</summary>
                <textarea
                  aria-label="Saved extracted resume text"
                  readOnly
                  value={saved.content.rawText}
                />
                <p>
                  This is the original text reference. Your saved edits appear
                  in the document below.
                </p>
              </details>
            </div>
          )}
        <ManualResumeEditor
          key={saved.id}
          context={context}
          initialDraft={fromResumeContent(saved.content)}
          savedVersion={saved.currentVersion}
          readiness={readiness}
          jdMatch={jdMatch}
          rewrite={rewrite}
          onDownload={() =>
            downloadResumePdf(api, saved.id, saved.currentVersion, saved.title)
          }
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
        <h1>Start a new resume.</h1>
        <p>A blank page with room for your experience.</p>
      </div>
      <section className="rf-upload-panel">
        <AsciiSpotlight
          bright
          theme={context.theme}
          reducedMotion={context.reducedMotion}
        />
        <h2>Create a blank resume</h2>
        <p>
          No profile setup needed. Your account name can fill the header;
          professional details come from you.
        </p>
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
        {loading ? (
          <RequestFeedback
            label="Creating your resume"
            reducedMotion={context.reducedMotion}
          />
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
export default ResumeRemoteRoot;
