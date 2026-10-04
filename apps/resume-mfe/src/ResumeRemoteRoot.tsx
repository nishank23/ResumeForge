import React, { useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import {
  AuroraBackdrop,
  Button,
  ResumeIntentPrompt,
  type ResumeCreationMode,
  type ShellFederationContext,
} from "@resume-forge/shared";

import { ManualResumeEditor } from "./ManualResumeEditor";
import { SAMPLE_RESUME } from "./sample-resume";

export interface ResumeRemoteRootProps {
  readonly context?: ShellFederationContext;
  readonly view?: "create" | "editor";
}

export function ResumeRemoteRoot({
  context,
  view = "editor",
}: ResumeRemoteRootProps) {
  const [intentText, setIntentText] = useState("");
  const [creationMode, setCreationMode] =
    useState<ResumeCreationMode>("profile_copy");
  const [intentReady, setIntentReady] = useState(false);
  const prefix = `/w/${context?.activeWorkspace.id ?? "ws-personal-01"}`;
  const goBack = () => {
    context?.onNavigate?.(`${prefix}/resumes`);
  };
  if (view === "editor")
    return <ManualResumeEditor context={context} sample={SAMPLE_RESUME} />;
  return (
    <div
      className="rf-page"
      data-remote-module="resume_mfe"
      data-react-version={React.version}
    >
      {context?.onNavigate ? (
        <button className="rf-back" onClick={goBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          My resumes
        </button>
      ) : null}
      {
        <>
          <div className="rf-page-heading">
            <h1>Start with your experience.</h1>
            <p>Choose a starting point for your next resume.</p>
          </div>
          <section className="rf-create-panel">
            <AuroraBackdrop staticMode reducedMotion={context?.reducedMotion} />
            <div className="rf-create-content">
              <ResumeIntentPrompt
                value={intentText}
                onChange={setIntentText}
                mode={creationMode}
                onModeChange={(mode) => {
                  setCreationMode(mode);
                  setIntentReady(false);
                }}
                onSubmitIntent={() => {
                  setIntentReady(true);
                }}
              />
            </div>
          </section>
          {intentReady ? (
            <div className="rf-preview-confirmation" role="status">
              <FileText size={24} />
              <div>
                <h2>Your starting point is selected</h2>
                <p>
                  Draft creation and AI tailoring are not connected yet. You can
                  explore the sample editor now; your input will not be sent or
                  saved.
                </p>
                {context?.onNavigate ? (
                  <Button
                    onClick={() => {
                      context.onNavigate?.(`${prefix}/resumes/res-draft-01`);
                    }}
                  >
                    Open sample editor
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="rf-create-notes">
            <div>
              <h3>Your profile stays yours</h3>
              <p>Resume changes will stay separate from your master profile.</p>
            </div>
            <div>
              <h3>You review every change</h3>
              <p>Suggestions are compared before you choose to apply them.</p>
            </div>
            <div>
              <h3>One clear starting layout</h3>
              <p>
                A simple, readable document that puts your experience first.
              </p>
            </div>
          </div>
        </>
      }
    </div>
  );
}
export default ResumeRemoteRoot;
