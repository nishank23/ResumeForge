import { useRef } from "react";
import { cn } from "../../utils/cn";
import { useDecorativeActivity, useReducedMotion } from "../../utils/motion";
import { RequestFeedback } from "./forge-feedback";

/** A document scan for real page requests, never a simulated progress meter. */
export function StudioLoading({
  compact = false,
  reducedMotion,
  className,
}: {
  readonly compact?: boolean;
  readonly reducedMotion?: boolean;
  readonly className?: string;
}) {
  const label = "Loading your workspace";
  const ref = useRef<HTMLDivElement>(null);
  const quiet = useReducedMotion() || reducedMotion === true;
  const active = useDecorativeActivity(ref);
  return (
    <div
      ref={ref}
      className={cn(
        "rf-studio-loading",
        compact && "rf-studio-loading-compact",
        className,
      )}
      data-reduced-motion={quiet}
      data-active={active}
      aria-busy="true"
      aria-label={label}
    >
      <div className="rf-studio-loading-art" aria-hidden="true">
        <span className="rf-studio-loading-corner" />
        <span className="rf-studio-loading-corner" />
        <span className="rf-studio-loading-corner" />
        <span className="rf-studio-loading-corner" />
        <div className="rf-studio-loading-sheet">
          <span className="rf-studio-loading-fold" />
          <span className="rf-studio-loading-heading" />
          <span className="rf-studio-loading-line" />
          <span className="rf-studio-loading-line" />
          <span className="rf-studio-loading-line" />
          <span className="rf-studio-loading-scan" />
        </div>
      </div>
      <RequestFeedback label={label} reducedMotion={quiet || !active} />
    </div>
  );
}
