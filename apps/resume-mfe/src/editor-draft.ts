import type { SummaryDocument } from "@resume-forge/shared";
import type { EditorAppearance } from "./editor-appearance";

// Local synthetic draft only. Contact values never enter a profile or AI payload.
export type SectionKind =
  "summary" | "experience" | "education" | "projects" | "skills" | "languages";
export const SECTION_LABELS: Record<SectionKind, string> = {
  summary: "Professional summary",
  experience: "Work experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  languages: "Languages",
};
export const SKILL_GROUPS = [
  "Programming languages",
  "Frameworks & libraries",
  "Tools & platforms",
  "Databases",
  "Soft skills",
] as const;
export interface DraftItem {
  id: string;
  text: string;
  hidden: boolean;
}
export interface DraftLanguage extends DraftItem {
  proficiency: string;
}
export interface DraftLink {
  id: string;
  label: string;
  url: string;
}
export interface DraftDates {
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  current: boolean;
  yearOnly: boolean;
}
export interface DraftEntry {
  id: string;
  hidden: boolean;
  title: string;
  subtitle: string;
  location: string;
  employmentType: string;
  locationType: string;
  fieldOfStudy: string;
  grade: string;
  dates: DraftDates;
  description: SummaryDocument;
  bullets: DraftItem[];
  technologies: string;
  links: DraftLink[];
}
export interface DraftSection {
  id: string;
  kind: SectionKind;
  label: string;
  hidden: boolean;
  summary: SummaryDocument;
  entries: DraftEntry[];
  groups: { id: string; label: string; items: DraftItem[] }[];
  languages: DraftLanguage[];
}
export interface ResumeDraft {
  appearance?: EditorAppearance;
  synthetic: boolean;
  title: string;
  header: {
    firstName: string;
    lastName: string;
    headline: string;
    city: string;
    state: string;
    country: string;
    links?: DraftLink[];
  };
  sampleContact: { phone: string; email: string };
  sections: DraftSection[];
}
// Local presentation adapter: retain language identity/proficiency when grouping it under Skills.
export function groupLanguagesUnderSkills(draft: ResumeDraft): ResumeDraft {
  const next = structuredClone(draft);
  const languageSections = next.sections.filter((s) => s.kind === "languages");
  if (!languageSections.length) return next;
  let skills = next.sections.find((s) => s.kind === "skills");
  if (!skills) {
    skills = emptySection("skills", "grouped-skills");
    next.sections.push(skills);
  }
  for (const section of languageSections)
    skills.languages.push(
      ...section.languages.map((item) => ({
        ...item,
        hidden: item.hidden || section.hidden,
      })),
    );
  next.sections = next.sections.filter((s) => s.kind !== "languages");
  return next;
}
export type DraftTarget =
  | { type: "header" }
  | { type: "section"; sectionId: string }
  | { type: "entry"; sectionId: string; itemId: string }
  | { type: "bullet"; sectionId: string; entryId: string; itemId: string }
  | { type: "skill"; sectionId: string; groupId: string; itemId: string }
  | { type: "language"; sectionId: string; itemId: string };
export const emptyRichText = (): SummaryDocument => ({
  type: "doc",
  content: [{ type: "paragraph" }],
});
export function emptyEntry(id: string): DraftEntry {
  return {
    id,
    hidden: false,
    title: "",
    subtitle: "",
    location: "",
    employmentType: "",
    locationType: "",
    fieldOfStudy: "",
    grade: "",
    dates: {
      startMonth: "",
      startYear: "",
      endMonth: "",
      endYear: "",
      current: false,
      yearOnly: false,
    },
    description: emptyRichText(),
    bullets: [],
    technologies: "",
    links: [],
  };
}
export function emptySection(kind: SectionKind, id: string): DraftSection {
  return {
    id,
    kind,
    label: SECTION_LABELS[kind],
    hidden: false,
    summary: emptyRichText(),
    entries: [],
    groups:
      kind === "skills"
        ? SKILL_GROUPS.map((label, i) => ({
            id: `${id}-group-${String(i)}`,
            label,
            items: [],
          }))
        : [],
    languages: [],
  };
}
export function sectionFor(
  draft: ResumeDraft,
  target: DraftTarget,
): DraftSection | undefined {
  return target.type === "header"
    ? undefined
    : draft.sections.find((s) => s.id === target.sectionId);
}
export function targetValue(
  draft: ResumeDraft,
  target: DraftTarget,
): DraftSection | DraftEntry | DraftItem | undefined {
  const section = sectionFor(draft, target);
  if (!section) return undefined;
  switch (target.type) {
    case "header":
      return undefined;
    case "section":
      return section;
    case "entry":
      return section.entries.find((e) => e.id === target.itemId);
    case "bullet":
      return section.entries
        .find((e) => e.id === target.entryId)
        ?.bullets.find((b) => b.id === target.itemId);
    case "skill":
      return section.groups
        .find((g) => g.id === target.groupId)
        ?.items.find((i) => i.id === target.itemId);
    case "language":
      return section.languages.find((i) => i.id === target.itemId);
  }
}
export function targetLabel(draft: ResumeDraft, target: DraftTarget): string {
  if (target.type === "header") return "Name & contact details";
  const value = targetValue(draft, target);
  if (!value) return "Selection no longer exists";
  if ("label" in value) return value.label;
  if ("title" in value) return value.title || "New entry";
  return value.text || "New item";
}
export const sameTarget = (a: DraftTarget, b: DraftTarget) =>
  JSON.stringify(a) === JSON.stringify(b);
export type MutationResult =
  { ok: true; draft: ResumeDraft } | { ok: false; error: string };
function listFor(
  draft: ResumeDraft,
  target: DraftTarget,
): { id: string; hidden: boolean }[] | undefined {
  const section = sectionFor(draft, target);
  switch (target.type) {
    case "header":
      return undefined;
    case "section":
      return draft.sections;
    case "entry":
      return section?.entries;
    case "bullet":
      return section?.entries.find((e) => e.id === target.entryId)?.bullets;
    case "skill":
      return section?.groups.find((g) => g.id === target.groupId)?.items;
    case "language":
      return section?.languages;
  }
}
export function mutateTarget(
  draft: ResumeDraft,
  target: DraftTarget,
  action: "up" | "down" | "hide" | "delete",
): MutationResult {
  if (target.type === "header")
    return {
      ok: false,
      error: "The resume header cannot be moved, hidden or deleted.",
    };
  const next = structuredClone(draft);
  const list = listFor(next, target);
  const id = target.type === "section" ? target.sectionId : target.itemId;
  const index = list?.findIndex((item) => item.id === id) ?? -1;
  const item = list?.[index];
  if (!list || !item)
    return {
      ok: false,
      error: "This selection no longer exists. Select it again.",
    };
  if (action === "hide") item.hidden = !item.hidden;
  else if (action === "delete") list.splice(index, 1);
  else {
    const destination = index + (action === "up" ? -1 : 1);
    if (destination < 0 || destination >= list.length) {
      return {
        ok: false,
        error: `Already at the ${action === "up" ? "top" : "bottom"} of this ${target.type === "section" ? "resume" : "list"}. Nothing was moved.`,
      };
    }
    list.splice(index, 1);
    list.splice(destination, 0, item);
  }
  return { ok: true, draft: next };
}
export function safeLink(url: string): boolean {
  try {
    const value = new URL(url);
    return (
      ["http:", "https:"].includes(value.protocol) &&
      !value.username &&
      !value.password
    );
  } catch {
    return false;
  }
}
export interface ValidationIssue {
  path: string;
  message: string;
}
export function validateEntry(
  entry: DraftEntry,
  kind: SectionKind,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!entry.title.trim())
    issues.push({
      path: "entry.title",
      message:
        kind === "education"
          ? "Enter the institution name."
          : "Enter a title or project name.",
    });
  if ((kind === "experience" || kind === "education") && !entry.subtitle.trim())
    issues.push({
      path: "entry.subtitle",
      message:
        kind === "education"
          ? "Enter the degree."
          : "Enter the company or organization.",
    });
  const d = entry.dates;
  for (const key of ["startYear", "endYear"] as const) {
    if (d[key] && !/^\d{4}$/.test(d[key]))
      issues.push({
        path: `entry.dates.${key}`,
        message: "Use a four-digit year.",
      });
  }
  for (const key of ["startMonth", "endMonth"] as const) {
    if (d[key] && !/^(0?[1-9]|1[0-2])$/.test(d[key]))
      issues.push({
        path: `entry.dates.${key}`,
        message: "Choose a valid month.",
      });
    if (d[key] && !d[key === "startMonth" ? "startYear" : "endYear"])
      issues.push({
        path: `entry.dates.${key === "startMonth" ? "startYear" : "endYear"}`,
        message: "Add a year for this month.",
      });
  }
  if (d.current && (d.endMonth || d.endYear))
    issues.push({
      path: "entry.dates.endYear",
      message: "A current role cannot have an end date.",
    });
  if (d.startYear && d.endYear && !d.current) {
    const start =
      Number(d.startYear) * 12 + (d.yearOnly ? 0 : Number(d.startMonth || 1));
    const end =
      Number(d.endYear) * 12 + (d.yearOnly ? 0 : Number(d.endMonth || 12));
    if (end < start)
      issues.push({
        path: "entry.dates.endYear",
        message: "The end date must be on or after the start date.",
      });
  }
  entry.links.forEach((link, i) => {
    if (link.url.trim() && !safeLink(link.url.trim()))
      issues.push({
        path: `entry.links.${String(i)}.url`,
        message: "Use an HTTP or HTTPS URL without embedded credentials.",
      });
    if (link.url.trim() && !link.label.trim())
      issues.push({
        path: `entry.links.${String(i)}.label`,
        message: "Give this link a label.",
      });
  });
  return issues;
}
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export function formatDates(d: DraftDates): string {
  const part = (year: string, month: string) =>
    [!d.yearOnly && month ? MONTHS[Number(month) - 1] : "", year]
      .filter(Boolean)
      .join(" ");
  return [
    part(d.startYear, d.startMonth),
    d.current ? "Present" : part(d.endYear, d.endMonth),
  ]
    .filter(Boolean)
    .join(" – ");
}
export function richTextPlain(doc: SummaryDocument): string {
  const walk = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const value = node as { type?: string; text?: string; content?: unknown[] };
    if (value.type === "text") return value.text ?? "";
    if (value.type === "hardBreak") return "\n";
    return (value.content ?? [])
      .map(walk)
      .join(value.type === "doc" || value.type === "bulletList" ? "\n" : "");
  };
  return walk(doc);
}

export type InlineField =
  | "sectionLabel"
  | "title"
  | "subtitle"
  | "location"
  | "employmentType"
  | "locationType"
  | "fieldOfStudy"
  | "grade"
  | "technologies"
  | "text"
  | "proficiency"
  | "firstName"
  | "lastName"
  | "headline"
  | "city"
  | "state"
  | "country"
  | "phone"
  | "email";
export function updateInlineDraft(
  draft: ResumeDraft,
  target: DraftTarget,
  field: InlineField,
  text: string,
): MutationResult {
  const next = structuredClone(draft);
  const value = text.trim();
  if (target.type === "header") {
    if (field === "phone" || field === "email") {
      if (
        field === "email" &&
        value &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      )
        return {
          ok: false,
          error:
            "Enter a valid email address. The previous value was restored.",
        };
      next.sampleContact[field] = value;
    } else if (
      field === "firstName" ||
      field === "lastName" ||
      field === "headline" ||
      field === "city" ||
      field === "state" ||
      field === "country"
    ) {
      if (field === "firstName" && !value)
        return {
          ok: false,
          error:
            "First name cannot be empty. Use the Edit dialog to review details.",
        };
      next.header[field] = value;
    } else return { ok: false, error: "This field is not part of the header." };
    return { ok: true, draft: next };
  }
  const item = targetValue(next, target);
  if (!item) return { ok: false, error: "This selection no longer exists." };
  if (
    field === "sectionLabel" &&
    target.type === "section" &&
    "label" in item
  ) {
    if (!value)
      return { ok: false, error: "A section heading cannot be empty." };
    item.label = value;
  } else if (
    target.type === "entry" &&
    "title" in item &&
    (field === "title" ||
      field === "subtitle" ||
      field === "location" ||
      field === "employmentType" ||
      field === "locationType" ||
      field === "fieldOfStudy" ||
      field === "grade" ||
      field === "technologies")
  ) {
    if (field === "title" && !value)
      return {
        ok: false,
        error: "A title cannot be empty. Use Delete to remove this entry.",
      };
    if (
      field === "subtitle" &&
      !value &&
      sectionFor(next, target)?.kind !== "projects"
    )
      return { ok: false, error: "Company or degree cannot be empty." };
    item[field] = value;
  } else if (field === "text" && "text" in item) {
    if (!value)
      return {
        ok: false,
        error: "An item cannot be empty. Use Delete to remove it.",
      };
    item.text = value;
  } else if (
    field === "proficiency" &&
    target.type === "language" &&
    "proficiency" in item
  )
    item.proficiency = value;
  else
    return {
      ok: false,
      error: "This field does not belong to the selected content.",
    };
  return { ok: true, draft: next };
}
