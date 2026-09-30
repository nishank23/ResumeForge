import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  Aurora,
  FloatingSparkles,
  GlassCard,
  GradientText,
  NodeGraphBackground,
  Prompt,
  PromptHero,
} from "performative-ui";
import {
  AlertTriangle,
  Check,
  FileCheck2,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  ResumeCreationIntent,
  ResumeCreationMode,
  ResumeSectionProposal,
  ResumeSuggestionAction,
  ResumeTargetSelection,
} from "@resume-forge/shared-types";
import { cn } from "../../utils/cn";
import {
  useDecorativeActivity,
  useMobileOrTouchViewport,
  useReducedMotion,
} from "../../utils/motion";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FieldError,
} from "./primitives";

// ── 1. AuroraBackdrop ─────────────────────────────────────────────────

export interface AuroraBackdropProps extends HTMLAttributes<HTMLDivElement> {
  readonly staticMode?: boolean;
  readonly reducedMotion?: boolean;
  readonly blur?: number;
}

const RESUME_FORGE_AURORA_BLOBS = [
  { color: "rgba(67, 56, 202, 0.24)", x: 18, y: 26, size: 58 },
  { color: "rgba(99, 102, 241, 0.20)", x: 82, y: 24, size: 48 },
  { color: "rgba(2, 132, 199, 0.16)", x: 52, y: 78, size: 50 },
];

export function AuroraBackdrop({
  staticMode = false,
  reducedMotion: explicitReduced,
  blur = 52,
  className,
  ...props
}: AuroraBackdropProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isReducedMotion = useReducedMotion(explicitReduced);
  const isActive = useDecorativeActivity(containerRef);
  const { isCompact } = useMobileOrTouchViewport();

  // Force static rendering when reduced motion is preferred, tab/viewport is inactive, or on narrow mobile
  const shouldRemainStatic =
    staticMode || isReducedMotion || !isActive || isCompact;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      tabIndex={-1}
      data-decorative-state={shouldRemainStatic ? "static" : "animated"}
      className={cn(
        "rf-decorative-layer pointer-events-none absolute inset-0 overflow-hidden select-none z-0",
        className,
      )}
      {...props}
    >
      <Aurora
        blobs={RESUME_FORGE_AURORA_BLOBS}
        blur={isCompact ? 36 : blur}
        static={shouldRemainStatic}
        animated={false}
      />
    </div>
  );
}

// ── 2. NodeGraphBackdrop ──────────────────────────────────────────────

export interface NodeGraphBackdropProps extends HTMLAttributes<HTMLDivElement> {
  readonly density?: number;
  readonly reducedMotion?: boolean;
}

export function NodeGraphBackdrop({
  density = 38,
  reducedMotion: explicitReduced,
  className,
  ...props
}: NodeGraphBackdropProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isReducedMotion = useReducedMotion(explicitReduced);
  const isActive = useDecorativeActivity(containerRef);
  const { isCompact, isCoarsePointer } = useMobileOrTouchViewport();

  // Unmount animated canvas completely when reduced-motion is active or container is offscreen/hidden tab
  const shouldRenderCanvas = !isReducedMotion && isActive;
  // Bound mobile rendering budget and disable cursor effects on touch/mobile
  const boundedDensity = isCompact
    ? Math.min(density, 18)
    : Math.min(density, 48);
  const disableCursorEffects = isCompact || isCoarsePointer;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      tabIndex={-1}
      data-decorative-state={
        shouldRenderCanvas ? "canvas-active" : "static-fallback"
      }
      className={cn(
        "rf-decorative-layer pointer-events-none absolute inset-0 overflow-hidden select-none z-0",
        className,
      )}
      {...props}
    >
      {shouldRenderCanvas ? (
        <NodeGraphBackground
          density={boundedDensity}
          speed={0.28}
          linkDistance={115}
          colors={["#6366f1", "#818cf8", "#0284c7"]}
          linkColor="#6366f1"
          baseOpacity={0.28}
          hoverDistance={disableCursorEffects ? 0 : 140}
          hoverGravity={disableCursorEffects ? 0 : 0.003}
          hoverBrighten={disableCursorEffects ? 0 : 0.4}
          className="pointer-events-none"
        />
      ) : (
        <div
          className="h-full w-full opacity-35"
          style={{
            background:
              "radial-gradient(circle at 25% 30%, rgba(99, 102, 241, 0.16), transparent 60%), radial-gradient(circle at 75% 70%, rgba(2, 132, 199, 0.12), transparent 60%)",
          }}
        />
      )}
    </div>
  );
}

// ── 3. SparkleFieldAccent ─────────────────────────────────────────────

export interface SparkleFieldAccentProps extends HTMLAttributes<HTMLDivElement> {
  readonly active?: boolean;
  readonly count?: number;
  readonly autoStopMs?: number;
  readonly reducedMotion?: boolean;
}

export function SparkleFieldAccent({
  active = true,
  count = 10,
  autoStopMs = 5000,
  reducedMotion: explicitReduced,
  className,
  ...props
}: SparkleFieldAccentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isReducedMotion = useReducedMotion(explicitReduced);
  const isVisible = useDecorativeActivity(containerRef);
  const { isCompact } = useMobileOrTouchViewport();
  const [withinDuration, setWithinDuration] = useState(true);

  useEffect(() => {
    if (!active || autoStopMs <= 0) return;
    setWithinDuration(true);
    const timer = setTimeout(() => {
      setWithinDuration(false);
    }, autoStopMs);
    return () => {
      clearTimeout(timer);
    };
  }, [active, autoStopMs]);

  const shouldRender =
    active && withinDuration && !isReducedMotion && isVisible;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      tabIndex={-1}
      data-decorative-state={shouldRender ? "active" : "stopped"}
      className={cn(
        "rf-decorative-layer pointer-events-none absolute inset-0 overflow-hidden select-none z-0",
        className,
      )}
      {...props}
    >
      {shouldRender ? (
        <FloatingSparkles
          count={isCompact ? Math.min(count, 6) : count}
          durationS={[6, 12]}
          sizeRange={[9, 15]}
        />
      ) : null}
    </div>
  );
}

// ── 4. GlassCardSurface ───────────────────────────────────────────────

export interface GlassCardSurfaceProps extends ComponentPropsWithoutRef<"article"> {
  readonly breathing?: boolean;
  readonly glowOnHover?: boolean;
  readonly editing?: boolean;
  readonly reducedMotion?: boolean;
}

export type GlassCardIconWrapperProps = ComponentPropsWithoutRef<"div"> & {
  readonly children: ReactNode;
};
export type GlassCardTitleWrapperProps = ComponentPropsWithoutRef<"h3">;
export type GlassCardBodyWrapperProps = ComponentPropsWithoutRef<"p">;
export type GlassCardLinkWrapperProps = ComponentPropsWithoutRef<"a">;

export function GlassCardIcon({
  children,
  ...props
}: GlassCardIconWrapperProps) {
  return <GlassCard.Icon {...props}>{children}</GlassCard.Icon>;
}

export function GlassCardTitle(props: GlassCardTitleWrapperProps) {
  return <GlassCard.Title {...props} />;
}

export function GlassCardBody(props: GlassCardBodyWrapperProps) {
  return <GlassCard.Body {...props} />;
}

export function GlassCardLink(props: GlassCardLinkWrapperProps) {
  return <GlassCard.Link {...props} />;
}

export const GlassCardSurface = Object.assign(
  function GlassCardSurfaceRoot({
    breathing = false,
    glowOnHover = true,
    editing = false,
    reducedMotion: explicitReduced,
    className,
    children,
    ...props
  }: GlassCardSurfaceProps) {
    const isReducedMotion = useReducedMotion(explicitReduced);
    // Continuous breathing stays off while editing or under reduced motion
    const allowBreathing = breathing && !editing && !isReducedMotion;

    return (
      <GlassCard
        breathing={allowBreathing}
        glowOnHover={glowOnHover && !isReducedMotion}
        className={cn(
          "bg-[var(--surface)]/95 border border-[var(--border)] text-[var(--foreground)] shadow-sm",
          className,
        )}
        {...props}
      >
        {children}
      </GlassCard>
    );
  },
  {
    Icon: GlassCardIcon,
    Title: GlassCardTitle,
    Body: GlassCardBody,
    Link: GlassCardLink,
  },
);

// ── 5. GradientHeadingAccent ──────────────────────────────────────────

export interface GradientHeadingAccentProps extends ComponentPropsWithoutRef<"span"> {
  readonly as?: ElementType;
  readonly staticMode?: boolean;
  readonly reducedMotion?: boolean;
}

export function GradientHeadingAccent({
  as,
  staticMode = false,
  reducedMotion: explicitReduced,
  className,
  children,
  ...props
}: GradientHeadingAccentProps) {
  const isReducedMotion = useReducedMotion(explicitReduced);
  return (
    <GradientText
      as={as}
      static={staticMode || isReducedMotion}
      className={cn("font-bold tracking-tight", className)}
      {...props}
    >
      {children}
    </GradientText>
  );
}

// ── 6. ResumeIntentPrompt (PromptHero Wrapper) ────────────────────────

export interface ResumeIntentPromptProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly mode: ResumeCreationMode;
  readonly onModeChange: (mode: ResumeCreationMode) => void;
  readonly onSubmitIntent: (intent: ResumeCreationIntent) => void;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly templateId?: string;
  readonly className?: string;
}

const CREATION_MODES: ReadonlyArray<{
  readonly id: ResumeCreationMode;
  readonly label: string;
  readonly description: string;
}> = [
  {
    id: "profile_copy",
    label: "From my profile",
    description: "Start with your experience, skills and education.",
  },
  {
    id: "tailor_jd",
    label: "Tailor to a role",
    description: "Focus your experience on a job description.",
  },
  {
    id: "blank",
    label: "Start from scratch",
    description: "Build your resume one section at a time.",
  },
];

export function ResumeIntentPrompt({
  value,
  onChange,
  mode,
  onModeChange,
  onSubmitIntent,
  busy = false,
  disabled = false,
  error,
  templateId = "single-column-ats-v1",
  className,
}: ResumeIntentPromptProps) {
  const [missingRole, setMissingRole] = useState(false);
  const inputError =
    error ??
    (missingRole
      ? "Describe the target role to preview tailoring."
      : undefined);
  const baseId = useId();
  const inputId = `rf-intent-input-${baseId}`;
  const labelId = `rf-intent-label-${baseId}`;
  const hintId = `rf-intent-hint-${baseId}`;
  const errorId = `rf-intent-err-${baseId}`;
  const promptHeroContainerRef = useRef<HTMLDivElement | null>(null);
  const isComposingRef = useRef(false);
  const isLocked = busy || disabled;

  useEffect(() => {
    const container = promptHeroContainerRef.current;
    if (!container) return;
    const inputEl =
      container.querySelector<HTMLInputElement>("input, textarea");
    if (!inputEl) return;
    inputEl.id = inputId;
    inputEl.name = "resume-intent-summary";
    inputEl.setAttribute("aria-labelledby", labelId);
    inputEl.setAttribute(
      "aria-describedby",
      inputError ? `${hintId} ${errorId}` : hintId,
    );
  }, [inputId, labelId, hintId, errorId, inputError]);

  const handleSubmit = (submittedText: string) => {
    if (isLocked || isComposingRef.current) return;
    const trimmed = submittedText.trim();
    if (!trimmed && mode === "tailor_jd") {
      setMissingRole(true);
      return;
    }
    onSubmitIntent({
      mode,
      intentSummary:
        trimmed ||
        (mode === "profile_copy"
          ? "Create draft from master profile facts"
          : "Create blank structured draft"),
      templateId,
    });
  };

  const handleKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent;
    if (
      event.key === "Enter" &&
      (nativeEvent.isComposing || isComposingRef.current || isLocked)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      aria-busy={busy || undefined}
      onCompositionStartCapture={() => {
        isComposingRef.current = true;
      }}
      onCompositionEndCapture={() => {
        isComposingRef.current = false;
      }}
      onKeyDownCapture={handleKeyDownCapture}
      className={cn("space-y-3", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          id={labelId}
          htmlFor={inputId}
          className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2"
        >
          <Sparkles
            className="h-4 w-4 text-[var(--primary)]"
            aria-hidden="true"
          />
          <span>How would you like to start?</span>
        </label>
        <Badge variant="outline">Single-column layout</Badge>
      </div>

      <div
        role="radiogroup"
        aria-label="Resume creation mode"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {CREATION_MODES.map((item) => {
          const selected = mode === item.id;
          return (
            <label
              key={item.id}
              className={cn(
                "flex flex-col items-start rounded-[var(--radius-control)] border p-4 text-left transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-55",
                selected
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              <input
                type="radio"
                name={`creation-mode-${baseId}`}
                value={item.id}
                checked={selected}
                disabled={isLocked}
                onChange={() => {
                  setMissingRole(false);
                  onModeChange(item.id);
                }}
                className="mb-3 accent-[var(--primary)]"
              />
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {item.label}
              </span>
              <span className="mt-0.5 text-[11px] leading-snug text-[var(--muted-foreground)]">
                {item.description}
              </span>
            </label>
          );
        })}
      </div>

      <div
        ref={promptHeroContainerRef}
        aria-labelledby={labelId}
        aria-describedby={inputError ? `${hintId} ${errorId}` : hintId}
        className={cn(isLocked && "pointer-events-none opacity-65")}
      >
        <PromptHero
          value={value}
          onChange={(next) => {
            if (!isLocked) {
              setMissingRole(false);
              onChange(next);
            }
          }}
          onSubmit={handleSubmit}
          placeholder={
            mode === "tailor_jd"
              ? "Describe the role you have in mind…"
              : "Add an optional focus for your resume…"
          }
          ctaLabel={busy ? "Preparing…" : "Preview starting point"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
        <p id={hintId}>
          Preview only. Your note stays in this page; no draft is created or
          saved.
        </p>
        {busy ? <Badge variant="default">Request in progress…</Badge> : null}
      </div>

      {inputError ? <FieldError id={errorId} message={inputError} /> : null}
    </div>
  );
}

// ── 7. ResumeSectionPrompt (Prompt Wrapper) ───────────────────────────

export interface ResumeSectionPromptProps {
  readonly target: ResumeTargetSelection;
  readonly selectedAction: ResumeSuggestionAction;
  readonly onSelectAction: (action: ResumeSuggestionAction) => void;
  readonly instruction: string;
  readonly onInstructionChange: (value: string) => void;
  readonly onSubmitRequest: (payload: {
    readonly target: ResumeTargetSelection;
    readonly action: ResumeSuggestionAction;
    readonly instruction: string;
  }) => void;
  readonly hasJobDescription: boolean;
  readonly jdTitle?: string;
  readonly hasUnsavedManualEdits?: boolean;
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly maxLength?: number;
  readonly className?: string;
}

const SECTION_ACTIONS: ReadonlyArray<{
  readonly id: ResumeSuggestionAction;
  readonly label: string;
  readonly requiresJd?: boolean;
}> = [
  { id: "improve_wording", label: "Improve wording" },
  { id: "make_concise", label: "Make concise" },
  { id: "emphasize_impact", label: "Highlight impact" },
  { id: "tailor_to_jd", label: "Tailor to a role", requiresJd: true },
];

export function ResumeSectionPrompt({
  target,
  selectedAction,
  onSelectAction,
  instruction,
  onInstructionChange,
  onSubmitRequest,
  hasJobDescription,
  jdTitle,
  hasUnsavedManualEdits = false,
  busy = false,
  disabled = false,
  error,
  maxLength = 400,
  className,
}: ResumeSectionPromptProps) {
  const baseId = useId();
  const textareaId = `rf-section-prompt-input-${baseId}`;
  const composerLabelId = `rf-section-prompt-label-${baseId}`;
  const errorId = `rf-section-prompt-err-${baseId}`;
  const promptContainerRef = useRef<HTMLDivElement | null>(null);
  const isComposingRef = useRef(false);

  const isBlockedByUnsaved = hasUnsavedManualEdits;
  const isLocked = busy || disabled || isBlockedByUnsaved;

  useEffect(() => {
    const container = promptContainerRef.current;
    if (!container) return;
    const fieldEl = container.querySelector<
      HTMLTextAreaElement | HTMLInputElement
    >("textarea, input");
    if (!fieldEl) return;
    fieldEl.id = textareaId;
    fieldEl.name = "resume-section-instruction";
    fieldEl.setAttribute("aria-labelledby", composerLabelId);
    fieldEl.setAttribute(
      "aria-label",
      `Custom instruction for ${target.sectionLabel}`,
    );
  }, [textareaId, composerLabelId, target.sectionLabel]);

  const handlePromptSubmit = (text: string) => {
    if (isLocked || isComposingRef.current) return;
    if (selectedAction === "tailor_to_jd" && !hasJobDescription) return;
    onSubmitRequest({
      target,
      action: selectedAction,
      instruction: text.trim().slice(0, maxLength),
    });
  };

  const handleKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent;
    if (
      event.key === "Enter" &&
      (nativeEvent.isComposing || isComposingRef.current || isLocked)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <Card
      aria-labelledby={composerLabelId}
      aria-busy={busy || undefined}
      onCompositionStartCapture={() => {
        isComposingRef.current = true;
      }}
      onCompositionEndCapture={() => {
        isComposingRef.current = false;
      }}
      onKeyDownCapture={handleKeyDownCapture}
      className={cn("w-full", className)}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle
            id={composerLabelId}
            className="text-sm flex items-center gap-2"
          >
            <Sparkles
              className="h-4 w-4 text-[var(--primary)]"
              aria-hidden="true"
            />
            <span>Improve this section</span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="default">{target.sectionLabel}</Badge>
          </div>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          Choose a direction, then review the sample before applying it.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Selected JD context badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2 text-xs">
          <span>
            <strong>Target role:</strong>{" "}
            {hasJobDescription
              ? (jdTitle ?? "Parsed Job Description attached")
              : "No job description"}
          </span>
          {!hasJobDescription ? (
            <span className="text-[var(--muted-foreground)]">
              Tailoring needs a job description.
            </span>
          ) : null}
        </div>

        {/* Action chips */}
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-[var(--foreground)]">
            Choose a direction
          </span>
          <div
            role="group"
            aria-label="Section rewrite actions"
            className="flex flex-wrap gap-2"
          >
            {SECTION_ACTIONS.map((action) => {
              const jdMissing = Boolean(
                action.requiresJd && !hasJobDescription,
              );
              const isSelected = selectedAction === action.id;
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={isLocked || jdMissing}
                  aria-pressed={isSelected}
                  title={
                    jdMissing
                      ? "Disabled: select a parsed Job Description first"
                      : action.label
                  }
                  onClick={() => {
                    onSelectAction(action.id);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
                  )}
                >
                  <span>{action.label}</span>
                  {jdMissing ? (
                    <span className="text-[10px] opacity-80">
                      (Unavailable)
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guard when unsaved manual edits exist */}
        {isBlockedByUnsaved ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[var(--warning)]/50 bg-[var(--warning)]/10 p-2.5 text-xs text-[var(--foreground)]"
          >
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]"
              aria-hidden="true"
            />
            <span>
              You have unsaved manual edits in this section. Save or discard
              your manual edits first so the suggestion binds to a persisted
              base version.
            </span>
          </div>
        ) : null}

        {/* Performative UI Prompt composer with voice/model/attachment controls hidden */}
        <div
          ref={promptContainerRef}
          aria-label={`Custom instruction for ${target.sectionLabel}`}
          className={cn(isLocked && "pointer-events-none opacity-60")}
        >
          <Prompt
            value={instruction}
            onChange={(next) => {
              if (!isLocked && next.length <= maxLength) {
                onInstructionChange(next);
              }
            }}
            onSubmit={(text) => {
              handlePromptSubmit(text);
            }}
            placeholder={`What would you like to improve in ${target.sectionLabel.toLowerCase()}?`}
            rows={3}
            models={[]}
            hideAddContext
            hideModel
            hideVoice
            submitOnCmdEnter={!isLocked}
            toolbarExtras={
              <div className="flex items-center gap-2 pr-1 text-[11px] text-[var(--muted-foreground)]">
                <span>
                  {instruction.length}/{maxLength}
                </span>
                <span className="hidden sm:inline">
                  · ⌘/Ctrl + Enter to request
                </span>
              </div>
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-[var(--muted-foreground)]">
            Changes apply only to this section.
          </span>
          <Button
            size="sm"
            loading={busy}
            loadingText="Preparing suggestion…"
            disabled={
              isLocked ||
              (selectedAction === "tailor_to_jd" && !hasJobDescription)
            }
            onClick={() => {
              handlePromptSubmit(instruction);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Preview sample suggestion</span>
          </Button>
        </div>

        {error ? <FieldError id={errorId} message={error} /> : null}
      </CardContent>
    </Card>
  );
}

// ── 8. SuggestionReviewPanel (Accessible Before/After Comparison) ─────

export interface SuggestionReviewPanelProps {
  readonly proposal: ResumeSectionProposal;
  readonly onApply: (suggestionId: string) => void;
  readonly onDiscard: (suggestionId: string) => void;
  readonly onRetry: (suggestionId: string) => void;
  readonly applying?: boolean;
  readonly discarding?: boolean;
  readonly className?: string;
}

const ORIGIN_LABELS: Record<string, string> = {
  profile_revision: "Master Profile Fact",
  manual_confirmation: "Confirmed Resume-Local Fact",
  confirmed_import: "Reviewed Import Fact",
};

export function SuggestionReviewPanel({
  proposal,
  onApply,
  onDiscard,
  onRetry,
  applying = false,
  discarding = false,
  className,
}: SuggestionReviewPanelProps) {
  const isStale = proposal.status === "stale";
  const isReady = proposal.status === "ready";
  const isApplied = proposal.status === "applied";
  const isDiscarded = proposal.status === "discarded";
  const isBusy =
    applying ||
    discarding ||
    proposal.status === "queued" ||
    proposal.status === "running";

  return (
    <Card
      role="region"
      aria-label={`Suggestion review for ${proposal.target.sectionLabel}`}
      className={cn("w-full border-[var(--primary)]/40", className)}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCheck2
                className="h-4 w-4 text-[var(--primary)]"
                aria-hidden="true"
              />
              <span>
                Review Scoped Suggestion · {proposal.target.sectionLabel}
                {proposal.target.itemLabel
                  ? ` (${proposal.target.itemLabel})`
                  : ""}
              </span>
            </CardTitle>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Base Version: <strong>v{proposal.baseVersionNumber}</strong> (rev
              #{proposal.expectedRevision}) · Action:{" "}
              <span className="font-mono">{proposal.action}</span>
            </p>
          </div>

          <Badge
            variant={
              isApplied
                ? "success"
                : isStale || proposal.status === "failed"
                  ? "destructive"
                  : isReady
                    ? "default"
                    : "secondary"
            }
          >
            Status: {proposal.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isStale ? (
          <div
            role="alert"
            className="rounded-md border border-[var(--destructive)]/50 bg-[var(--destructive)]/10 p-3 text-xs text-[var(--foreground)]"
          >
            <strong>Base version changed (Conflict prevented):</strong> The
            underlying resume was edited after this suggestion was requested.
            Late or stale proposals are never auto-merged. Please retry against
            the latest version.
          </div>
        ) : null}

        {/* Accessible side-by-side Before / After text comparison */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section
            aria-label="Original section text (Before)"
            className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Before (Persisted v{proposal.baseVersionNumber})
              </span>
              <Badge variant="outline">Unchanged until Apply</Badge>
            </div>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {proposal.originalText}
            </p>
          </section>

          <section
            aria-label="Proposed section text (After)"
            className="rounded-[var(--radius-control)] border border-[var(--primary)]/50 bg-[var(--surface)] p-3.5 shadow-xs"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                After (Proposed v{proposal.baseVersionNumber + 1})
              </span>
              <Badge variant="default">Grounded Rewrite</Badge>
            </div>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {proposal.proposedText ?? "Generating grounded proposal…"}
            </p>
          </section>
        </div>

        {/* Reason & supporting fact provenance */}
        {proposal.reason ? (
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3 text-xs">
            <strong className="text-[var(--foreground)]">
              Why this change helps:{" "}
            </strong>
            <span className="text-[var(--muted-foreground)]">
              {proposal.reason}
            </span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Supporting Fact Provenance ({proposal.supportingFacts.length})
          </h4>
          <ul className="space-y-1.5" aria-label="Supporting profile facts">
            {proposal.supportingFacts.map((fact) => (
              <li
                key={fact.factId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
              >
                <span className="text-[var(--foreground)]">{fact.summary}</span>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  {ORIGIN_LABELS[fact.origin] ?? fact.origin} · {fact.factId}{" "}
                  (rev #{fact.sourceRevision})
                </span>
              </li>
            ))}
          </ul>
        </div>

        {proposal.missingEvidenceNote ? (
          <div
            role="note"
            className="rounded-md border border-[var(--warning)]/50 bg-[var(--surface-muted)] p-3 text-xs text-[var(--foreground)]"
          >
            <strong>Missing Evidence Notice: </strong>
            <span className="text-[var(--muted-foreground)]">
              {proposal.missingEvidenceNote}
            </span>
          </div>
        ) : null}

        {/* Explicit Apply / Discard / Retry controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          <span className="text-xs text-[var(--muted-foreground)]">
            Applying commits immutable{" "}
            <strong>Version v{proposal.baseVersionNumber + 1}</strong> and marks
            prior ATS scores/PDFs stale.
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => {
                onRetry(proposal.suggestionId);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              loading={discarding}
              loadingText="Discarding…"
              disabled={isBusy || isApplied || isDiscarded}
              onClick={() => {
                onDiscard(proposal.suggestionId);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Discard</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              loading={applying}
              loadingText="Applying version…"
              disabled={!isReady || isBusy}
              onClick={() => {
                onApply(proposal.suggestionId);
              }}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Apply as v{proposal.baseVersionNumber + 1}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
