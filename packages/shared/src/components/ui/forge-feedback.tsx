import type { HTMLAttributes, ReactNode } from "react";
import {
  BeforeAfter,
  ChatBubble,
  StatusDot,
  WibblingSpinner,
} from "performative-ui";
import { cn } from "../../utils/cn";
import { useReducedMotion } from "../../utils/motion";

/** Status is always named in text; the dot is decorative and never pulses. */
export function DocumentStatus({
  children,
  tone = "saved",
  className,
}: {
  children: ReactNode;
  tone?: "saved" | "pending" | "error" | "neutral";
  className?: string;
}) {
  const colors = {
    saved: "var(--success)",
    pending: "var(--warning)",
    error: "var(--destructive)",
    neutral: "var(--muted-foreground)",
  };
  return (
    <span className={cn("rf-document-status", className)}>
      <StatusDot static color={colors[tone]} />
      <span>{children}</span>
    </span>
  );
}

/** Mount only during a real request. Quiet mode does not mount timer-driven glyphs. */
export function RequestFeedback({
  label,
  reducedMotion,
  className,
}: {
  label: string;
  reducedMotion?: boolean;
  className?: string;
}) {
  const quiet = useReducedMotion() || reducedMotion === true;
  return (
    <span role="status" className={cn("rf-request-feedback", className)}>
      <span className="sr-only">{label}…</span>
      <span aria-hidden="true">
        {quiet ? (
          <span>{label}…</span>
        ) : (
          <WibblingSpinner verbs={[label]} glyphColor="var(--primary)" />
        )}
      </span>
    </span>
  );
}

/** Full text remains available in addition to the inline del/ins view. */
export function TextComparison({
  original,
  suggested,
}: {
  original: string;
  suggested: string;
}) {
  return (
    <BeforeAfter className="rf-text-comparison">
      <BeforeAfter.Before label="Original">
        <p>{original}</p>
      </BeforeAfter.Before>
      <BeforeAfter.After label="Suggested">
        <p>{suggested}</p>
      </BeforeAfter.After>
    </BeforeAfter>
  );
}

/** Presentation of returned evidence, without simulated conversation or thinking. */
export function EvidenceNote({
  children,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "role">) {
  return (
    <ChatBubble
      role="ai"
      thinking={false}
      icon={false}
      className={cn("rf-evidence-note", className)}
      {...props}
    >
      {children}
    </ChatBubble>
  );
}
