import { useEffect, useRef, useState } from "react";
import { FileCheck2, Upload } from "lucide-react";
import {
  Button,
  Dialog,
  RequestFeedback,
  type ShellFederationContext,
} from "@resume-forge/shared";
import { RESUME_UI_FEATURES } from "./ui-features";
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
  const [reading, setReading] = useState(false),
    [error, setError] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const busy = useRef(false),
    saving = useRef(false),
    active = useRef(true);
  const createId = useRef(crypto.randomUUID()),
    reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (staged) reviewHeading.current?.focus();
  }, [staged]);
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
      {staged ? (
        <section
          className="rf-import-fullpage"
          aria-labelledby="rf-import-review-heading"
        >
          <div className="rf-import-review-banner">
            <div>
              <h2
                id="rf-import-review-heading"
                ref={reviewHeading}
                tabIndex={-1}
              >
                Review your import
              </h2>
              <p>
                {fileName} · Unsaved import. Check names, dates and sections
                before confirming.
              </p>
            </div>
            <Button variant="outline" onClick={close}>
              Discard upload
            </Button>
          </div>
          {RESUME_UI_FEATURES.showExtractedText ? (
            <details className="rf-import-source">
              <summary>
                <FileCheck2 size={16} aria-hidden="true" />
                Read extracted text
              </summary>
              <textarea
                aria-label="Extracted resume text"
                readOnly
                value={staged.text}
              />
              <p>
                Original layout is not preserved. Correct the fields below, then
                confirm the import.
              </p>
            </details>
          ) : null}
          <ManualResumeEditor
            context={{
              ...context,
              onNavigate: () => {
                if (!saving.current) onClose();
              },
            }}
            initialDraft={staged.draft}
            savedVersion={0}
            saveLabel="Confirm import"
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
        </section>
      ) : (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
          title="Upload your resume"
          description="Bring your experience into Forge Studio."
          className="rf-import-dialog"
          bodyClassName="rf-import-dialog-body"
          footer={
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
          }
        >
          <div className="rf-import-pick">
            <div className="rf-import-mark" aria-hidden="true">
              <Upload size={28} />
            </div>
            <h3>Start with your experience</h3>
            <p>Choose a file, review the imported fields, then save.</p>
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
              Processed on the server. Your upload is not sent to an AI provider
              during import. Scanned or encrypted PDFs need a text-based copy.
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
        </Dialog>
      )}
      <Dialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard this upload?"
        description="Your imported review has not been saved. Discarding returns to your resumes."
        footer={
          <>
            <Button variant="outline" onClick={() => { setDiscarding(false); }}>
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
