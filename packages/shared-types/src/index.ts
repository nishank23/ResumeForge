/**
 * @resume-forge/shared-types
 *
 * Validated public contracts for the resume-forge platform.
 * Profile/contact DTOs, resume/version contracts, workspace, federation,
 * and contextual section-editing schemas.
 *
 * Keep private persistence models out of public exports.
 */

// ── Workspace types ───────────────────────────────────────────────────

/** The three workspace types supported by resume-forge. */
export type WorkspaceType = "individual" | "organization" | "vendor";

/** Minimal workspace identity for scoped queries and cache keys. */
export interface WorkspaceRef {
  readonly id: string;
  readonly type: WorkspaceType;
  readonly name: string;
  readonly roleLabel?: string;
}

// ── API envelope ──────────────────────────────────────────────────────

/** Standard success envelope for all API responses. */
export interface ApiResponse<T> {
  readonly data: T;
  readonly meta?: Record<string, unknown>;
}

/** Standard error envelope. Never expose stack traces or raw provider payloads. */
export interface ApiError {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

// ── Professional profile boundary ────────────────────────────────────

/** Base professional fields only. Protected contacts and auth identity are excluded. */
export interface ProfessionalProfileDto {
  readonly id: string;
  readonly fullName: string;
  readonly location: string | null;
  readonly professionalSummary: string | null;
  readonly revision: number;
}

// ── Resume & Task lifecycle statuses ──────────────────────────────────

/** Resume lifecycle statuses from the data model. */
export type ResumeStatus = "generating" | "completed" | "failed";

/** Honest task execution stages driven by server events (never fabricated percentages). */
export type TaskLifecycleState =
  "idle" | "queued" | "running" | "ready" | "failed" | "stale";

// ── Contextual section-editing contracts (Phase 1 foundation for F06/F08) ──

/**
 * Eligible resume section types for contextual prompting.
 * Protected UserContact / header fields are explicitly excluded from AI targets.
 */
export type ResumeSectionType =
  | "summary"
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "certifications";

/** Stable section/item target identity that survives edits and reordering. */
export interface ResumeTargetSelection {
  readonly sectionId: string;
  readonly sectionType: ResumeSectionType;
  readonly sectionLabel: string;
  readonly itemId?: string;
  readonly itemLabel?: string;
  readonly currentText: string;
}

/** Supported contextual actions in the section composer. */
export type ResumeSuggestionAction =
  "improve_wording" | "make_concise" | "emphasize_impact" | "tailor_to_jd";

/** Suggestion lifecycle states from resume-editing-contract.md. */
export type ResumeSuggestionStatus =
  "queued" | "running" | "ready" | "applied" | "discarded" | "failed" | "stale";

/** Provenance origin for grounded resume facts (U06 contract). */
export type FactOrigin =
  "profile_revision" | "manual_confirmation" | "confirmed_import";

/** Supporting fact reference displayed during suggestion review. */
export interface ResumeFactReference {
  readonly factId: string;
  readonly summary: string;
  readonly origin: FactOrigin;
  readonly sourceRevision: number;
}

/**
 * Scoped section suggestion proposal bound to a persisted base version and revision.
 * Phase 1 defines the contract and synthetic UI states; Phase 2 wires service persistence.
 */
export interface ResumeSectionProposal {
  readonly suggestionId: string;
  readonly workspaceId: string;
  readonly resumeId: string;
  readonly baseVersionId: string;
  readonly baseVersionNumber: number;
  readonly expectedRevision: number;
  readonly target: ResumeTargetSelection;
  readonly action: ResumeSuggestionAction;
  readonly instruction?: string;
  readonly jdHistoryId?: string;
  readonly jdTitle?: string;
  readonly status: ResumeSuggestionStatus;
  readonly originalText: string;
  readonly proposedText?: string;
  readonly reason?: string;
  readonly supportingFacts: readonly ResumeFactReference[];
  readonly missingEvidenceNote?: string;
  readonly updatedAt: string;
}

/** Creation mode selected at the ResumeIntentPrompt entry point. */
export type ResumeCreationMode = "profile_copy" | "tailor_jd" | "blank";

/** Intent payload emitted by ResumeIntentPrompt (never sent in URL query strings). */
export interface ResumeCreationIntent {
  readonly mode: ResumeCreationMode;
  readonly intentSummary: string;
  readonly templateId: string;
}

// ── Microfrontend Federation Contracts ────────────────────────────────

/** Application color theme mode. Printable resume pages always remain white/dark-text. */
export type ThemeMode = "light" | "dark";

/**
 * Browser-safe context passed from the Shell host to federated remotes.
 * Never pass secrets, raw tokens, or ORM models through federation props.
 */
export interface ShellFederationContext {
  readonly activeWorkspace: WorkspaceRef;
  readonly availableWorkspaces: readonly WorkspaceRef[];
  readonly theme: ThemeMode;
  readonly reducedMotion: boolean;
  readonly apiBaseUrl: string;
  readonly onSelectWorkspace?: (workspaceId: string) => void;
  readonly onToggleTheme?: () => void;
  readonly onNavigate?: (path: string) => void;
}

export {
  editorDocumentSchema,
  richDocumentSchema,
  type EditorDocument,
  type RichDocument,
} from "./editor-document.js";

export * from "./readiness.js";

export * from "./jd-match.js";
export * from "./ats-workflow.js";

export { readinessHints } from "./readiness-hints.js";
