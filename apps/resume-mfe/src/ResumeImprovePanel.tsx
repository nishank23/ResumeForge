import { useState, type KeyboardEvent } from "react";
import { Button } from "@resume-forge/shared";
import { AtsJobFitPanel, type AtsJobFitServices } from "./AtsJobFitPanel";
import {
  ResumeReadabilityPanel,
  type ReadabilityServices,
} from "./ResumeReadabilityPanel";

export function ResumeImprovePanel(props: {
  readability?: ReadabilityServices;
  atsAssessment?: AtsJobFitServices;
  savedVersion: number;
  dirty: boolean;
  saving: boolean;
  disabledReason?: string;
  atsDisabledReason?: string;
  reducedMotion?: boolean;
  onSave: () => void;
  onWrite: () => void;
  onDesign: () => void;
  onTailor?: (jd: string) => void;
}) {
  const [active, setActive] = useState<"readability" | "job-fit">(
    "readability",
  );
  const select = (next: typeof active) => {
    setActive(next);
    document.getElementById(`rf-improve-tab-${next}`)?.focus();
  };
  const keys = (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    select(
      event.key === "Home"
        ? "readability"
        : event.key === "End"
          ? "job-fit"
          : active === "readability"
            ? "job-fit"
            : "readability",
    );
  };
  return (
    <div className="rf-improve-panel">
      <div
        className="rf-improve-tabs"
        role="tablist"
        aria-label="Resume improvement"
      >
        {(["readability", "job-fit"] as const).map((key) => (
          <Button
            key={key}
            id={`rf-improve-tab-${key}`}
            role="tab"
            size="sm"
            variant="ghost"
            aria-selected={active === key}
            aria-controls={`rf-improve-${key}`}
            tabIndex={active === key ? 0 : -1}
            onKeyDown={keys}
            onClick={() => { setActive(key); }}
          >
            {key === "readability" ? "Readability" : "Job fit"}
          </Button>
        ))}
      </div>
      <div
        id="rf-improve-readability"
        className="rf-improve-tabpanel"
        role="tabpanel"
        aria-labelledby="rf-improve-tab-readability"
        hidden={active !== "readability"}
      >
        <ResumeReadabilityPanel
          services={props.readability}
          savedVersion={props.savedVersion}
          dirty={props.dirty}
          saving={props.saving}
          disabledReason={props.disabledReason}
          reducedMotion={props.reducedMotion}
          onSave={props.onSave}
          onWrite={props.onWrite}
          onDesign={props.onDesign}
        />
      </div>
      <div
        id="rf-improve-job-fit"
        className="rf-improve-tabpanel"
        role="tabpanel"
        aria-labelledby="rf-improve-tab-job-fit"
        hidden={active !== "job-fit"}
      >
        <AtsJobFitPanel
          services={props.atsAssessment}
          savedVersion={props.savedVersion}
          disabledReason={props.atsDisabledReason}
          reducedMotion={props.reducedMotion}
          onWrite={props.onWrite}
          onTailor={props.onTailor}
        />
      </div>
    </div>
  );
}
