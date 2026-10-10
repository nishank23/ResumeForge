import { useEffect, useRef, useState } from "react";
import { FileCheck2, Upload } from "lucide-react";
import {
  Button,
  Dialog,
  RequestFeedback,
  type ShellFederationContext,
} from "@resume-forge/shared";
import { ManualResumeEditor } from "./ManualResumeEditor";
import type { createResumeApi } from "./resume-api";
import type { ResumeDraft } from "./editor-draft";

export function ResumeImportDialog({
  context,
  api,
  onClose,
}: {
  context: ShellFederationContext;
  api: ReturnType<typeof createResumeApi>;
  onClose: () => void;
}) {
  const [staged, setStaged] = useState<{
    draft: ResumeDraft;
    text: string;
  } | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const busy = useRef(false);
  const saving = useRef(false);
  const active = useRef(true);
  const createId = useRef(crypto.randomUUID());
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const close = () => {
    if (saving.current) return;
    if (staged) setDiscarding(true);
    else onClose();
  };
  const choose = async (file: File) => {
    if (busy.current) return;
    busy.current = true;
    setReading(true);
    setError("");
    setFileName(file.name);
    try {
      const result = await api.parse(file);
      if (active.current) setStaged(result);
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error
            ? e.message
            : "Could not read this file. Choose another file or retry.",
        );
    } finally {
      busy.current = false;
      if (active.current) setReading(false);
    }
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={staged ? "Review your imported resume" : "Upload your resume"}
        description={
          staged
            ? `${fileName} · Check the extracted fields before saving.`
            : "Bring your experience into Forge Studio."
        }
        className={`rf-import-dialog${staged ? " is-review" : ""}`}
        bodyClassName="rf-import-dialog-body"
        footer={
          !staged ? (
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
          ) : undefined
        }
      >
        {staged ? (
          <>
            <details className="rf-import-source">
              <summary>
                <FileCheck2 size={16} aria-hidden="true" /> Review extracted
                text
              </summary>
              <textarea
                aria-label="Extracted resume text"
                readOnly
                value={staged.text}
              />
              <p>
                Original layout is not preserved. Correct the fields below, then
                confirm and save.
              </p>
            </details>
            <ManualResumeEditor
              context={{
                ...context,
                onNavigate: () => {
                  if (!saving.current) onClose();
                },
              }}
              initialDraft={staged.draft}
              savedVersion={0}
              saveLabel="Confirm and save resume"
              onSave={async (draft) => {
                saving.current = true;
                try {
                  const next = await api.create(
                    createId.current,
                    draft,
                    staged.text,
                  );
                  context.onNavigate?.(
                    `/w/${context.activeWorkspace.id}/resumes/${next.id}`,
                  );
                  return next.currentVersion;
                } finally {
                  saving.current = false;
                }
              }}
            />
          </>
        ) : (
          <div className="rf-import-pick">
            <div className="rf-import-mark" aria-hidden="true">
              <Upload size={28} />
            </div>
            <h3>A fresh start for your resume</h3>
            <p>
              Choose a file. We’ll extract the text so you can review and edit
              it before anything is saved.
            </p>
            <label className="rf-import-file">
              <span>Choose resume file</span>
              <input
                aria-label="Choose resume file"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                disabled={reading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void choose(file);
                }}
              />
            </label>
            <small>Text-based PDF, DOCX, TXT or Markdown · up to 10 MB</small>
            <p className="rf-import-privacy">
              Processed on your local server. No AI provider receives the
              upload. Scanned or encrypted PDFs need a text-based copy.
            </p>
            {reading ? (
              <RequestFeedback
                label="Reading your resume"
                reducedMotion={context.reducedMotion}
              />
            ) : null}
            {error ? (
              <p role="alert" className="rf-import-error">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </Dialog>
      <Dialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard this upload?"
        description="Your imported review has not been saved. Discarding returns to your resumes."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDiscarding(false);
              }}
            >
              Keep reviewing
            </Button>
            <Button variant="destructive" onClick={onClose}>
              Discard upload
            </Button>
          </>
        }
      >
        <p>No saved resume will be changed.</p>
      </Dialog>
    </>
  );
}
