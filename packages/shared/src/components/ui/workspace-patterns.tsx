import type { HTMLAttributes, ReactNode } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  RefreshCw,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";
import type {
  TaskLifecycleState,
  WorkspaceRef,
  WorkspaceType,
} from "@resume-forge/shared-types";
import { cn } from "../../utils/cn";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./primitives";

// ── EmptyState ────────────────────────────────────────────────────────

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--primary)]"
      >
        {icon ?? <FileText className="h-5 w-5" />}
      </div>
      <h3 className="text-base font-semibold text-[var(--foreground)]">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
        {description}
      </p>
      {actionLabel && onAction ? (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

// ── RetryState ────────────────────────────────────────────────────────

export interface RetryStateProps extends HTMLAttributes<HTMLDivElement> {
  readonly title: string;
  readonly reason: string;
  readonly retryLabel?: string;
  readonly retrying?: boolean;
  readonly onRetry: () => void;
}

export function RetryState({
  title,
  reason,
  retryLabel = "Retry operation",
  retrying = false,
  onRetry,
  className,
  ...props
}: RetryStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--destructive)]/40 bg-[var(--surface)] p-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--destructive)]"
        />
        <div>
          <h4 className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h4>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {reason}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        loading={retrying}
        loadingText="Retrying…"
        onClick={onRetry}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{retryLabel}</span>
      </Button>
    </div>
  );
}

// ── PermissionDenialState ─────────────────────────────────────────────

export interface PermissionDenialStateProps extends HTMLAttributes<HTMLDivElement> {
  readonly requiredPermission: string;
  readonly resourceScope: string;
  readonly explanation?: string;
}

export function PermissionDenialState({
  requiredPermission,
  resourceScope,
  explanation = "Restricted fields are omitted on the server. Request an explicit workspace grant or switch to an authorized workspace.",
  className,
  ...props
}: PermissionDenialStateProps) {
  return (
    <div
      role="region"
      aria-label="Permission restricted"
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--warning)]/40 bg-[var(--surface)] p-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]"
        />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--foreground)]">
              Action restricted by workspace policy
            </h4>
            <Badge variant="warning">Permission Denied</Badge>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {explanation}
          </p>
          <p className="font-mono text-xs text-[var(--foreground)]">
            Required capability: <span>{requiredPermission}</span> · Scope:{" "}
            <span>{resourceScope}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── SaveIndicator ─────────────────────────────────────────────────────

export type SaveStatus = "saved" | "saving" | "unsaved" | "conflict" | "error";

export interface SaveIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  readonly status: SaveStatus;
  readonly versionNumber?: number;
  readonly lastSavedLabel?: string;
}

const SAVE_STATUS_CONFIG: Record<
  SaveStatus,
  {
    label: string;
    badgeVariant: "success" | "secondary" | "warning" | "destructive";
  }
> = {
  saved: { label: "Saved version", badgeVariant: "success" },
  saving: { label: "Saving version…", badgeVariant: "secondary" },
  unsaved: { label: "Unsaved manual edits", badgeVariant: "warning" },
  conflict: {
    label: "Revision conflict — reload required",
    badgeVariant: "destructive",
  },
  error: {
    label: "Save failed — prior version preserved",
    badgeVariant: "destructive",
  },
};

export function SaveIndicator({
  status,
  versionNumber,
  lastSavedLabel,
  className,
  ...props
}: SaveIndicatorProps) {
  const cfg = SAVE_STATUS_CONFIG[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex flex-wrap items-center gap-2 text-xs",
        className,
      )}
      {...props}
    >
      <Badge variant={cfg.badgeVariant}>
        {status === "saved" ? (
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Clock className="h-3 w-3" aria-hidden="true" />
        )}
        <span>{cfg.label}</span>
      </Badge>
      {versionNumber !== undefined ? (
        <span className="font-mono text-[var(--muted-foreground)]">
          v{versionNumber}
        </span>
      ) : null}
      {lastSavedLabel ? (
        <span className="text-[var(--muted-foreground)]">
          · {lastSavedLabel}
        </span>
      ) : null}
    </div>
  );
}

// ── TaskStageIndicator (Honest server-driven stages, no fake %) ───────

export interface TaskStageItem {
  readonly id: string;
  readonly label: string;
  readonly status: TaskLifecycleState;
  readonly detail?: string;
}

export interface TaskStageIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  readonly title: string;
  readonly overallState: TaskLifecycleState;
  readonly stages: readonly TaskStageItem[];
  readonly onRetry?: () => void;
}

const STAGE_LABELS: Record<
  TaskLifecycleState,
  {
    text: string;
    variant: "secondary" | "default" | "success" | "destructive" | "warning";
  }
> = {
  idle: { text: "Idle", variant: "secondary" },
  queued: { text: "Queued", variant: "secondary" },
  running: { text: "Running", variant: "default" },
  ready: { text: "Completed", variant: "success" },
  failed: { text: "Failed", variant: "destructive" },
  stale: { text: "Stale — base version changed", variant: "warning" },
};

export function TaskStageIndicator({
  title,
  overallState,
  stages,
  onRetry,
  className,
  ...props
}: TaskStageIndicatorProps) {
  const overallBadge = STAGE_LABELS[overallState];

  return (
    <Card className={cn("w-full", className)} {...props}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant={overallBadge.variant}>{overallBadge.text}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <ol className="space-y-2" aria-label={`${title} stages`}>
          {stages.map((stage) => {
            const meta = STAGE_LABELS[stage.status];
            return (
              <li
                key={stage.id}
                className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-medium text-[var(--foreground)]">
                    {stage.label}
                  </span>
                  {stage.detail ? (
                    <p className="mt-0.5 text-[var(--muted-foreground)]">
                      {stage.detail}
                    </p>
                  ) : null}
                </div>
                <Badge variant={meta.variant}>{meta.text}</Badge>
              </li>
            );
          })}
        </ol>
        {overallState === "failed" && onRetry ? (
          <div className="pt-1">
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry task safely</span>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── ScoreBreakdownCard ────────────────────────────────────────────────

export interface ScoreDimension {
  readonly id: string;
  readonly label: string;
  readonly score: number;
  readonly maxScore: number;
  readonly statusLabel: "Strong" | "Needs review" | "Gap detected";
  readonly evidenceNote: string;
}

export interface ScoreBreakdownCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly hasJobDescription: boolean;
  readonly jdTitle?: string;
  readonly overallScore?: number;
  readonly rubricVersion?: string;
  readonly isStale?: boolean;
  readonly dimensions?: readonly ScoreDimension[];
}

export function ScoreBreakdownCard({
  hasJobDescription,
  jdTitle,
  overallScore,
  rubricVersion = "rubric-v1-preview",
  isStale = false,
  dimensions = [],
  className,
  ...props
}: ScoreBreakdownCardProps) {
  if (!hasJobDescription) {
    return (
      <Card className={cn("w-full", className)} {...props}>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">
              ATS Heuristic &amp; JD Alignment
            </CardTitle>
            <Badge variant="secondary">No JD Attached</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--muted-foreground)]">
            Basic profile-derived draft mode is active. ATS alignment scores are
            never fabricated without a parsed Job Description. Attach a JD in
            Phase 2 (F05/F07) to compute evidence-backed alignment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)} {...props}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm">ATS Alignment Heuristic</CardTitle>
            {jdTitle ? (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Target JD: {jdTitle} · {rubricVersion}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isStale ? (
              <Badge variant="warning">Stale for current version</Badge>
            ) : null}
            {overallScore !== undefined ? (
              <Badge variant={overallScore >= 80 ? "success" : "warning"}>
                Score: {overallScore}/100 (
                {overallScore >= 80 ? "Strong match" : "Review gaps"})
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {dimensions.map((dim) => (
          <div
            key={dim.id}
            className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2.5 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[var(--foreground)]">
                {dim.label}
              </span>
              <Badge
                variant={
                  dim.statusLabel === "Strong"
                    ? "success"
                    : dim.statusLabel === "Needs review"
                      ? "warning"
                      : "destructive"
                }
              >
                {dim.score}/{dim.maxScore} · {dim.statusLabel}
              </Badge>
            </div>
            <p className="mt-1 text-[var(--muted-foreground)]">
              {dim.evidenceNote}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── WorkspaceSelector ─────────────────────────────────────────────────

export interface WorkspaceSelectorProps {
  readonly activeWorkspace: WorkspaceRef;
  readonly workspaces: readonly WorkspaceRef[];
  readonly onSelectWorkspace: (workspaceId: string) => void;
  readonly className?: string;
}

const WORKSPACE_TYPE_LABELS: Record<WorkspaceType, string> = {
  individual: "Individual",
  organization: "Organization (Phase 4)",
  vendor: "Vendor (Phase 4)",
};

export function WorkspaceSelector({
  activeWorkspace,
  workspaces,
  onSelectWorkspace,
  className,
}: WorkspaceSelectorProps) {
  const Icon =
    activeWorkspace.type === "organization"
      ? Building2
      : activeWorkspace.type === "vendor"
        ? Users
        : User;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Icon
        className="h-4 w-4 text-[var(--primary)] shrink-0"
        aria-hidden="true"
      />
      <label htmlFor="rf-workspace-selector" className="sr-only">
        Active workspace selector (server validates membership)
      </label>
      <select
        id="rf-workspace-selector"
        value={activeWorkspace.id}
        onChange={(e) => {
          onSelectWorkspace(e.target.value);
        }}
        className="h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id} disabled={ws.type !== "individual"}>
            {ws.name} — {WORKSPACE_TYPE_LABELS[ws.type]}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── DocumentPageSurface (Opaque white printable resume surface) ───────

export interface DocumentSectionBlock {
  readonly sectionId: string;
  readonly sectionLabel: string;
  readonly itemId?: string;
  readonly itemLabel?: string;
  readonly content: string;
}

export interface DocumentPageSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  readonly candidateName: string;
  readonly contactNotice?: string;
  readonly versionNumber: number;
  readonly pageCount?: number;
  readonly pdfStale?: boolean;
  readonly selectedSectionId?: string;
  readonly sections: readonly DocumentSectionBlock[];
  readonly onSelectSection?: (section: DocumentSectionBlock) => void;
}

export function DocumentPageSurface({
  candidateName,
  contactNotice = "Contact details omitted",
  versionNumber,
  pageCount = 1,
  pdfStale = false,
  selectedSectionId,
  sections,
  onSelectSection,
  className,
  ...props
}: DocumentPageSurfaceProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)] rf-app-chrome">
        <span>Resume preview · Page 1 of {pageCount}</span>
        <div className="flex items-center gap-2">
          {pdfStale ? (
            <Badge variant="warning">Export needs updating</Badge>
          ) : (
            <Badge variant="outline">Single column</Badge>
          )}
        </div>
      </div>

      <article
        aria-label={`Resume preview for ${candidateName}, version ${String(versionNumber)}`}
        className="rf-document-page rounded-[var(--radius-card)] p-6 sm:p-8"
      >
        <header className="border-b border-gray-300 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              {candidateName}
            </h2>
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>{contactNotice}</span>
            </span>
          </div>
        </header>

        <div className="mt-5 space-y-4">
          {sections.map((section) => {
            const isSelected = selectedSectionId === section.sectionId;
            return (
              <section
                key={section.sectionId}
                aria-label={section.sectionLabel}
                className={cn(
                  "rounded-lg border p-3.5 transition-colors",
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/50"
                    : "border-gray-200 bg-white",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      {section.sectionLabel}
                    </h3>
                    {section.itemLabel ? (
                      <p className="text-xs font-medium text-gray-600">
                        {section.itemLabel}
                      </p>
                    ) : null}
                  </div>
                  {onSelectSection ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSection(section);
                      }}
                      aria-pressed={isSelected}
                      aria-label={`Select ${section.sectionLabel}`}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer rf-app-chrome",
                        isSelected
                          ? "bg-indigo-700 text-white"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200",
                      )}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-900">
                  {section.content}
                </p>
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}
