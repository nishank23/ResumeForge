import {
  READINESS_COMPONENTS,
  READINESS_RUBRIC,
} from "@resume-forge/resume-core";
import type {
  ReadinessCheck,
  ReadinessResult,
} from "@resume-forge/resume-core";
import type { ReadinessState } from "@resume-forge/shared-types";

export function needsReadinessCheck(
  state: ReadinessState,
  savedVersion: number,
) {
  return (
    savedVersion > 0 &&
    state.currentVersion === savedVersion &&
    (!state.evaluation ||
      state.evaluation.resumeVersion !== savedVersion ||
      state.evaluation.rubricVersion !== READINESS_RUBRIC)
  );
}
export function readinessGroups(
  result: Pick<ReadinessResult, "checks"> | null | undefined,
  dismissed: string[],
) {
  const hidden = new Set(dismissed);
  return {
    Pending: result?.checks.filter((c) => !c.passed && !hidden.has(c.id)) ?? [],
    Completed: result?.checks.filter((c) => c.passed) ?? [],
    Deleted: result?.checks.filter((c) => !c.passed && hidden.has(c.id)) ?? [],
  };
}
/** Focus the relevant field in the manual editor; never submits or applies a fix. */
export function readinessField(check: ReadinessCheck) {
  const rule = check.id.split(":")[0];
  if (rule === "contact-presence") return '[name="header.firstName"]';
  if (rule === "entry-technologies") return '[name="entry.technologies"]';
  if (rule === "education-details") return '[name="entry.subtitle"]';
  if (["complete-dates", "ordered-dates", "current-end"].includes(rule ?? ""))
    return '[name="entry.dates.startYear"]';
  if (rule === "entry-context") return '[name="entry.subtitle"]';
  if (
    [
      "entry-description",
      "readable-statements",
      "bullet-volume",
      "bold-formatting",
    ].includes(rule ?? "")
  )
    return '[contenteditable="true"]';
  if (check.componentId === "skills" || rule === "skills-section")
    return ".rf-tag-category input";
  if (rule === "section-headings") return '[name="label"]';
  return '[name="entry.title"]';
}

/** Presentation groups preserve every stable check and its exact action target. */
export function compactCheckGroups(checks: ReadinessCheck[]) {
  const groups = new Map<string, ReadinessCheck[]>();
  for (const check of checks) {
    const group = groups.get(check.componentId) ?? [];
    group.push(check);
    groups.set(check.componentId, group);
  }
  return [...groups].map(([id, checks]) => ({ id, checks }));
}

const ruleFamilies: Record<string, [string, string]> = {
  "professional-section": ["background", "Include work or projects"],
  "entry-details": ["background", "Include work or projects"],
  "skills-section": ["skills-section", "Include a skills section"],
  "listed-skills": ["skills-section", "Include a skills section"],
  "section-headings": ["organization", "Use clear section headings"],
  "organized-content": ["organization", "Organize the resume into sections"],
  "entry-title": ["entry-context", "Complete role and project details"],
  "entry-context": ["entry-context", "Complete role and project details"],
  "entry-description": ["entry-context", "Complete role and project details"],
  "skill-categories": ["skill-presentation", "Keep skills clear and distinct"],
  "distinct-skills": ["skill-presentation", "Keep skills clear and distinct"],
  "concise-skills": ["skill-presentation", "Keep skills clear and distinct"],
  "readable-statements": ["achievements", "Keep achievements readable"],
  "complete-dates": ["dates", "Keep dates complete and consistent"],
  "ordered-dates": ["dates", "Keep dates complete and consistent"],
  "current-end": ["dates", "Keep dates complete and consistent"],
  "date-evidence": ["dates", "Keep dates complete and consistent"],
};
/** A family completes only when every instance passes; mixed outcomes stay Pending. */
export function readinessRuleGroups(
  checks: ReadinessCheck[],
  dismissed: string[],
) {
  const hidden = new Set(dismissed);
  const families = new Map<
    string,
    { id: string; title: string; checks: ReadinessCheck[] }
  >();
  for (const check of checks) {
    const rule = check.id.split(":")[0] ?? check.id;
    const [id, title] = ruleFamilies[rule] ?? [rule, check.title];
    const group = families.get(id) ?? { id, title, checks: [] };
    group.checks.push(check);
    families.set(id, group);
  }
  const groups = {
    Pending: [...families.values()].filter((g) =>
      g.checks.some((c) => !c.passed && !hidden.has(c.id)),
    ),
    Completed: [...families.values()].filter((g) =>
      g.checks.every((c) => c.passed),
    ),
    Deleted: [...families.values()].filter((g) =>
      g.checks.some((c) => !c.passed && hidden.has(c.id)),
    ),
  };
  return groups;
}

/** Display priority only: reuse existing component weights, never change a score or check. */
export function priorityReadinessChecks(
  checks: ReadinessCheck[],
  dismissed: string[],
  limit = 3,
) {
  const pending = readinessGroups({ checks }, dismissed).Pending;
  const weight = (check: ReadinessCheck) =>
    READINESS_COMPONENTS.find((component) => component.id === check.componentId)
      ?.weight ?? 0;
  const ranked = [...pending].sort(
    (a, b) =>
      Number(a.scored === false) - Number(b.scored === false) ||
      weight(b) - weight(a),
  );
  const selected: ReadinessCheck[] = [],
    families = new Set<string>();
  for (const check of ranked) {
    const rule = check.id.split(":")[0] ?? check.id;
    const family = ruleFamilies[rule]?.[0] ?? rule;
    if (!families.has(family) && selected.length < limit) {
      selected.push(check);
      families.add(family);
    }
  }
  for (const check of ranked)
    if (selected.length < limit && !selected.includes(check))
      selected.push(check);
  return selected;
}
export function readinessActionLabel(check: ReadinessCheck) {
  const rule = check.id.split(":")[0] ?? check.id;
  const actions: Record<string, string> = {
    "contact-presence": "Add contact details",
    "skills-section": "Add skills",
    "listed-skills": "Add skills",
    "professional-section": "Add experience or a project",
    "entry-details": "Add experience or a project",
    "entry-title": "Add role details",
    "entry-context": "Edit role details",
    "entry-description": "Improve description",
    "complete-dates": "Review dates",
    "ordered-dates": "Review dates",
    "current-end": "Review dates",
    "date-evidence": "Review dates",
    "entry-technologies": "Add tools used",
    "education-details": "Review education",
    "readable-statements": "Review achievements",
    "section-headings": "Edit section heading",
    "bullet-volume": "Review achievements",
  };
  return actions[rule] ?? "Review this section";
}

/** Concise presentation only; the full returned reason stays in All checks. */
export function readinessReason(check: ReadinessCheck) {
  const rule = check.id.split(":")[0] ?? check.id;
  const reasons: Record<string, string> = {
    "entry-context":
      "Add the employer, team or project context for this entry.",
    "readable-statements":
      "Some statements are very short or long. This check looks for 8–60 words per description or achievement.",
    "complete-dates":
      "Add a start date and an end date, or mark the entry as current.",
    "ordered-dates": "Check that the end date comes after the start date.",
    "current-end":
      "Check the end date and whether this entry is marked current.",
  };
  return reasons[rule] ?? check.reason;
}
