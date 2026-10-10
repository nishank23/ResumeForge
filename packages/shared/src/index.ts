/**
 * @resume-forge/shared
 *
 * Browser-safe UI components, tokens, Performative UI wrappers,
 * federation boundaries, and utilities.
 * No secrets, provider calls, or database imports.
 */

import "./styles/styles.css";

export {
  SummaryEditor,
  type SummaryEditorProps,
} from "./components/ui/summary-editor";
export {
  normalizeSummary,
  summaryFromText,
  type SummaryDocument,
} from "./components/ui/summary-document";

// ── Utilities & Motion Hooks ──────────────────────────────────────────
export { cn } from "./utils/cn";
export {
  useReducedMotion,
  useDecorativeActivity,
  useMobileOrTouchViewport,
} from "./utils/motion";

// ── Core Accessible UI Primitives (shadcn/ui foundation) ──────────────
export {
  Button,
  buttonVariants,
  type ButtonProps,
  Label,
  type LabelProps,
  Input,
  type InputProps,
  Textarea,
  type TextareaProps,
  FormField,
  type FormFieldProps,
  FieldError,
  type FieldErrorProps,
  Select,
  type SelectOption,
  type SelectProps,
  Checkbox,
  type CheckboxProps,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  type BadgeProps,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
  type TabsTriggerProps,
  type TabsContentProps,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tooltip,
  type TooltipProps,
  ScrollArea,
  type ScrollAreaProps,
} from "./components/ui/primitives";

// ── Accessible Dialogs, AlertDialogs, Menus & Announcements ───────────
export {
  Dialog,
  type DialogProps,
  ConfirmDeleteDialog,
  type ConfirmDeleteDialogProps,
  DropdownMenu,
  type DropdownMenuItem,
  type DropdownMenuProps,
  StatusBanner,
  type StatusBannerTone,
  type StatusBannerProps,
} from "./components/ui/dialogs";

// ── Shared Workspace & Document Patterns ──────────────────────────────
export {
  EmptyState,
  type EmptyStateProps,
  RetryState,
  type RetryStateProps,
  PermissionDenialState,
  type PermissionDenialStateProps,
  SaveIndicator,
  type SaveStatus,
  type SaveIndicatorProps,
  TaskStageIndicator,
  type TaskStageItem,
  type TaskStageIndicatorProps,
  ScoreBreakdownCard,
  type ScoreDimension,
  type ScoreBreakdownCardProps,
  WorkspaceSelector,
  type WorkspaceSelectorProps,
  DocumentPageSurface,
  type DocumentSectionBlock,
  type DocumentPageSurfaceProps,
} from "./components/ui/workspace-patterns";

// ── Performative UI Wrappers & Scoped Editing Surfaces ────────────────
export {
  AuroraBackdrop,
  type AuroraBackdropProps,
  NodeGraphBackdrop,
  type NodeGraphBackdropProps,
  SparkleFieldAccent,
  type SparkleFieldAccentProps,
  GlassCardSurface,
  type GlassCardSurfaceProps,
  GlassCardIcon,
  type GlassCardIconWrapperProps,
  GlassCardTitle,
  type GlassCardTitleWrapperProps,
  GlassCardBody,
  type GlassCardBodyWrapperProps,
  GlassCardLink,
  type GlassCardLinkWrapperProps,
  GradientHeadingAccent,
  type GradientHeadingAccentProps,
  ResumeIntentPrompt,
  type ResumeIntentPromptProps,
  ResumeSectionPrompt,
  type ResumeSectionPromptProps,
  SuggestionReviewPanel,
  type SuggestionReviewPanelProps,
} from "./components/ui/performative-wrappers";

// ── Microfrontend Federation Error & Suspense Boundaries ──────────────
export {
  RemoteErrorBoundary,
  type RemoteErrorBoundaryProps,
  RemoteLoadFallback,
  type RemoteFallbackProps,
  RemoteSuspenseFallback,
} from "./components/ui/remote-boundary";

// ── Re-export shared types for convenience ────────────────────────────
export type {
  WorkspaceRef,
  WorkspaceType,
  ApiResponse,
  ApiError,
  ResumeStatus,
  TaskLifecycleState,
  ResumeSectionType,
  ResumeTargetSelection,
  ResumeSuggestionAction,
  ResumeSuggestionStatus,
  FactOrigin,
  ResumeFactReference,
  ResumeSectionProposal,
  ResumeCreationMode,
  ResumeCreationIntent,
  ThemeMode,
  ShellFederationContext,
} from "@resume-forge/shared-types";
export { useSession } from "./auth/use-session";
export type { SessionState, SessionIdentity } from "./auth/session";

export {
  DocumentStatus,
  RequestFeedback,
  TextComparison,
  EvidenceNote,
} from "./components/ui/forge-feedback";

export {
  AsciiSpotlight,
  AssessmentMeter,
  StudioPrompt,
  ValidatedResponse,
} from "./components/ui/studio-widgets";
