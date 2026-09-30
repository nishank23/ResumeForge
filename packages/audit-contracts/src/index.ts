import {
  PERMISSION_NAMES,
  type PermissionName,
} from "@resume-forge/access-policy";
import type { WorkspaceType } from "@resume-forge/shared-types";

export const AUDIT_EVENT_NAMES = [
  "profile.viewed",
  "profile.updated",
  "contact.viewed",
  "contact.updated",
  "resume.created",
  "resume.generated",
  "resume.generation_completed",
  "resume.generation_failed",
  "resume.updated",
  "resume.downloaded",
  "resume.deleted",
  "member.invited",
  "member.removed",
  "member.role_changed",
  "member.accepted",
  "member.suspended",
  "profile.access_revoked",
  "authorization.denied",
  "resume.suggestion_requested",
  "resume.suggestion_ready",
  "resume.suggestion_failed",
  "resume.suggestion_discarded",
] as const;

export type AuditEventName = (typeof AUDIT_EVENT_NAMES)[number];

export const AUDIT_RESOURCE_TYPES = [
  "workspace",
  "profile",
  "contact",
  "resume",
  "resume_version",
  "artifact",
  "membership",
  "invitation",
  "suggestion",
  "task_run",
  "jd_history",
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export const AUDIT_OUTCOMES = ["succeeded", "failed", "denied"] as const;

export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export const AUDIT_METADATA_KEYS = [
  "permission",
  "reasonCode",
  "status",
  "versionId",
  "baseVersionId",
  "newVersionId",
  "suggestionId",
  "taskRunId",
  "artifactId",
  "membershipId",
  "invitationId",
] as const;

export type AuditMetadataKey = (typeof AUDIT_METADATA_KEYS)[number];
export type AuditMetadata = Readonly<Partial<Record<AuditMetadataKey, string>>>;

export interface AuditEventIntent {
  readonly eventId: string;
  readonly action: AuditEventName;
  readonly actorUserId: string;
  readonly targetUserId?: string;
  readonly workspaceType: WorkspaceType;
  readonly workspaceId: string;
  readonly resourceType: AuditResourceType;
  readonly resourceId: string;
  readonly outcome: AuditOutcome;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly metadata: AuditMetadata;
}

export type AuditValidationIssueCode =
  | "required"
  | "invalid_type"
  | "invalid_value"
  | "unknown_key"
  | "too_many_entries"
  | "resource_mismatch"
  | "outcome_mismatch";

export interface AuditValidationIssue {
  readonly path: string;
  readonly code: AuditValidationIssueCode;
}

export type AuditIntentValidationResult =
  | { readonly success: true; readonly data: AuditEventIntent }
  | {
      readonly success: false;
      readonly issues: readonly AuditValidationIssue[];
    };

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const SAFE_CODE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_METADATA_ENTRIES = 8;

const EVENT_NAMES: ReadonlySet<AuditEventName> = new Set(AUDIT_EVENT_NAMES);
const RESOURCE_TYPES: ReadonlySet<AuditResourceType> = new Set(
  AUDIT_RESOURCE_TYPES,
);
const OUTCOMES: ReadonlySet<AuditOutcome> = new Set(AUDIT_OUTCOMES);
const WORKSPACE_TYPES: ReadonlySet<WorkspaceType> = new Set([
  "individual",
  "organization",
  "vendor",
]);
const METADATA_KEYS = new Set<string>(AUDIT_METADATA_KEYS);
const PERMISSIONS = new Set<string>(PERMISSION_NAMES);

const RESOURCE_TYPES_BY_EVENT: Readonly<
  Partial<Record<AuditEventName, readonly AuditResourceType[]>>
> = {
  "profile.viewed": ["profile"],
  "profile.updated": ["profile"],
  "profile.access_revoked": ["profile"],
  "contact.viewed": ["contact"],
  "contact.updated": ["contact"],
  "resume.created": ["resume"],
  "resume.generated": ["resume"],
  "resume.generation_completed": ["resume"],
  "resume.generation_failed": ["resume"],
  "resume.updated": ["resume"],
  "resume.downloaded": ["resume"],
  "resume.deleted": ["resume"],
  "member.invited": ["invitation"],
  "member.removed": ["membership"],
  "member.role_changed": ["membership"],
  "member.accepted": ["membership", "invitation"],
  "member.suspended": ["membership"],
  "resume.suggestion_requested": ["suggestion"],
  "resume.suggestion_ready": ["suggestion"],
  "resume.suggestion_failed": ["suggestion"],
  "resume.suggestion_discarded": ["suggestion"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addIssue(
  issues: AuditValidationIssue[],
  path: string,
  code: AuditValidationIssueCode,
): void {
  issues.push({ path, code });
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  issues: AuditValidationIssue[],
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    addIssue(issues, key, "required");
    return undefined;
  }
  if (typeof value !== "string") {
    addIssue(issues, key, "invalid_type");
    return undefined;
  }
  return value;
}

function readSafeIdentifier(
  record: Record<string, unknown>,
  key: string,
  issues: AuditValidationIssue[],
): string | undefined {
  const value = readRequiredString(record, key, issues);
  if (value !== undefined && !SAFE_IDENTIFIER_PATTERN.test(value)) {
    addIssue(issues, key, "invalid_value");
    return undefined;
  }
  return value;
}

function readOptionalSafeIdentifier(
  record: Record<string, unknown>,
  key: string,
  issues: AuditValidationIssue[],
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    addIssue(issues, key, "invalid_type");
    return undefined;
  }
  if (!SAFE_IDENTIFIER_PATTERN.test(value)) {
    addIssue(issues, key, "invalid_value");
    return undefined;
  }
  return value;
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
  issues: AuditValidationIssue[],
): T | undefined {
  const value = readRequiredString(record, key, issues);
  if (value !== undefined && !allowed.has(value as T)) {
    addIssue(issues, key, "invalid_value");
    return undefined;
  }
  return value as T | undefined;
}

function readTimestamp(
  record: Record<string, unknown>,
  issues: AuditValidationIssue[],
): string | undefined {
  const value = readRequiredString(record, "occurredAt", issues);
  if (
    value !== undefined &&
    (!UTC_TIMESTAMP_PATTERN.test(value) || Number.isNaN(Date.parse(value)))
  ) {
    addIssue(issues, "occurredAt", "invalid_value");
    return undefined;
  }
  return value;
}

function readMetadata(
  value: unknown,
  issues: AuditValidationIssue[],
): AuditMetadata | undefined {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    addIssue(issues, "metadata", "invalid_type");
    return undefined;
  }

  const entries = Object.entries(value);
  if (entries.length > MAX_METADATA_ENTRIES) {
    addIssue(issues, "metadata", "too_many_entries");
  }

  const metadata: Partial<Record<AuditMetadataKey, string>> = {};
  for (const [key, item] of entries) {
    const path = `metadata.${key}`;
    if (!METADATA_KEYS.has(key)) {
      addIssue(issues, path, "unknown_key");
      continue;
    }
    if (typeof item !== "string") {
      addIssue(issues, path, "invalid_type");
      continue;
    }

    const isValidValue =
      key === "permission"
        ? PERMISSIONS.has(item)
        : key === "reasonCode" || key === "status"
          ? SAFE_CODE_PATTERN.test(item)
          : SAFE_IDENTIFIER_PATTERN.test(item);
    if (!isValidValue) {
      addIssue(issues, path, "invalid_value");
      continue;
    }

    metadata[key as AuditMetadataKey] = item;
  }

  return metadata;
}

function validateSemantics(
  action: AuditEventName,
  resourceType: AuditResourceType,
  outcome: AuditOutcome,
  issues: AuditValidationIssue[],
): void {
  const allowedResources = RESOURCE_TYPES_BY_EVENT[action];
  if (
    allowedResources !== undefined &&
    !allowedResources.includes(resourceType)
  ) {
    addIssue(issues, "resourceType", "resource_mismatch");
  }

  const isFailureEvent =
    action === "resume.generation_failed" ||
    action === "resume.suggestion_failed";
  if (action === "authorization.denied" && outcome !== "denied") {
    addIssue(issues, "outcome", "outcome_mismatch");
  } else if (action !== "authorization.denied" && outcome === "denied") {
    addIssue(issues, "outcome", "outcome_mismatch");
  } else if (isFailureEvent && outcome !== "failed") {
    addIssue(issues, "outcome", "outcome_mismatch");
  }
}

/**
 * Validates a content-free audit event intent before persistence or transport.
 * Unknown metadata is rejected so private values cannot silently enter logs.
 */
export function validateAuditEventIntent(
  input: unknown,
): AuditIntentValidationResult {
  if (!isRecord(input)) {
    return {
      success: false,
      issues: [{ path: "$", code: "invalid_type" }],
    };
  }

  const issues: AuditValidationIssue[] = [];
  const eventId = readSafeIdentifier(input, "eventId", issues);
  const action = readEnum<AuditEventName>(input, "action", EVENT_NAMES, issues);
  const actorUserId = readSafeIdentifier(input, "actorUserId", issues);
  const targetUserId = readOptionalSafeIdentifier(
    input,
    "targetUserId",
    issues,
  );
  const workspaceType = readEnum<WorkspaceType>(
    input,
    "workspaceType",
    WORKSPACE_TYPES,
    issues,
  );
  const workspaceId = readSafeIdentifier(input, "workspaceId", issues);
  const resourceType = readEnum<AuditResourceType>(
    input,
    "resourceType",
    RESOURCE_TYPES,
    issues,
  );
  const resourceId = readSafeIdentifier(input, "resourceId", issues);
  const outcome = readEnum<AuditOutcome>(input, "outcome", OUTCOMES, issues);
  const occurredAt = readTimestamp(input, issues);
  const correlationId = readSafeIdentifier(input, "correlationId", issues);
  const metadata = readMetadata(input.metadata, issues);

  if (
    eventId === undefined ||
    action === undefined ||
    actorUserId === undefined ||
    workspaceType === undefined ||
    workspaceId === undefined ||
    resourceType === undefined ||
    resourceId === undefined ||
    outcome === undefined ||
    occurredAt === undefined ||
    correlationId === undefined ||
    metadata === undefined
  ) {
    return { success: false, issues };
  }

  validateSemantics(action, resourceType, outcome, issues);
  if (issues.length > 0) return { success: false, issues };

  return {
    success: true,
    data: {
      eventId,
      action,
      actorUserId,
      ...(targetUserId === undefined ? {} : { targetUserId }),
      workspaceType,
      workspaceId,
      resourceType,
      resourceId,
      outcome,
      occurredAt,
      correlationId,
      metadata,
    },
  };
}

export function isPermissionMetadataValue(
  value: string,
): value is PermissionName {
  return PERMISSIONS.has(value);
}
