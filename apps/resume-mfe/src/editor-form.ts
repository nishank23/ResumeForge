import type { SummaryDocument } from "@resume-forge/shared";
import {
  emptyEntry,
  emptyRichText,
  sectionFor,
  richTextPlain,
  targetValue,
  validateEntry,
  safeLink,
  type DraftEntry,
  type DraftItem,
  type DraftLanguage,
  type DraftSection,
  type DraftTarget,
  type ResumeDraft,
  type ValidationIssue,
} from "./editor-draft.ts";

export interface EditorFormValues {
  title: string;
  header: ResumeDraft["header"];
  sampleContact: ResumeDraft["sampleContact"];
  label: string;
  summary: SummaryDocument;
  entry: DraftEntry;
  item: DraftItem;
  proficiency: string;
  groups: DraftSection["groups"];
  languages: DraftLanguage[];
}
export function formValues(
  draft: ResumeDraft,
  target: DraftTarget,
): EditorFormValues {
  const section = sectionFor(draft, target);
  const value = targetValue(draft, target);
  return structuredClone({
    title: draft.title,
    header: { ...draft.header, links: draft.header.links ?? [] },
    sampleContact: draft.sampleContact,
    label: section?.label ?? "",
    summary: section?.summary ?? emptyRichText(),
    entry: value && "title" in value ? value : emptyEntry("unused"),
    item:
      value && "text" in value
        ? value
        : { id: "unused", text: "", hidden: false },
    proficiency:
      value && "proficiency" in value ? String(value.proficiency) : "",
    groups: section?.groups ?? [],
    languages: section?.languages ?? [],
  });
}
// Project a dialog candidate onto its exact target. Never replace unrelated fields.
export function projectForm(
  draft: ResumeDraft,
  target: DraftTarget,
  values: EditorFormValues,
): ResumeDraft {
  const next = structuredClone(draft);
  if (target.type === "header") {
    next.title = values.title;
    next.header = structuredClone(values.header);
    next.sampleContact = structuredClone(values.sampleContact);
    return next;
  }
  const section = sectionFor(next, target);
  if (!section) return next;
  if (target.type === "section") {
    section.label = values.label;
    if (section.kind === "summary")
      section.summary = structuredClone(values.summary);
    if (section.kind === "skills") {
      section.groups = structuredClone(values.groups);
      section.languages = structuredClone(values.languages);
    }
    if (section.kind === "languages")
      section.languages = structuredClone(values.languages);
  } else if (target.type === "entry") {
    const index = section.entries.findIndex((e) => e.id === target.itemId);
    if (index >= 0)
      section.entries[index] = {
        ...structuredClone(values.entry),
        id: target.itemId,
      };
  } else {
    const value = targetValue(next, target);
    if (value && "text" in value) {
      value.text = values.item.text;
      if (target.type === "language" && "proficiency" in value)
        value.proficiency = values.proficiency;
    }
  }
  return next;
}
export function validateForm(
  draft: ResumeDraft,
  target: DraftTarget,
  values: EditorFormValues,
): ValidationIssue[] {
  if (target.type === "header") {
    const issues: ValidationIssue[] = [];
    if (!values.title.trim())
      issues.push({ path: "title", message: "Enter a resume title." });
    if (!values.header.firstName.trim())
      issues.push({ path: "header.firstName", message: "Enter a first name." });
    const email = values.sampleContact.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      issues.push({
        path: "sampleContact.email",
        message: "Enter a valid email address or leave it empty.",
      });
    (values.header.links ?? []).forEach((link, i) => {
      if (link.url && !safeLink(link.url))
        issues.push({
          path: `header.links.${String(i)}.url`,
          message: "Use an http or https link.",
        });
    });
    return issues;
  }
  if (!targetValue(draft, target))
    return [{ path: "root", message: "This selection no longer exists." }];
  if (target.type === "entry")
    return validateEntry(
      values.entry,
      sectionFor(draft, target)?.kind ?? "experience",
    );
  const issues: ValidationIssue[] = [];
  if (target.type === "section") {
    if (!values.label.trim())
      issues.push({ path: "label", message: "Enter a section heading." });
    if (sectionFor(draft, target)?.kind === "skills") {
      if (values.groups.length > 20)
        issues.push({
          path: "root",
          message: "Use at most 20 skill categories.",
        });
      const labels = new Set<string>(["languages"]);
      values.groups.forEach((group, i) => {
        const label = group.label.trim().toLowerCase();
        if (!label || group.label.length > 80 || labels.has(label))
          issues.push({
            path: `groups.${String(i)}.label`,
            message:
              "Use a unique category name of 1–80 characters. Languages is reserved.",
          });
        labels.add(label);
        if (group.items.length > 50)
          issues.push({
            path: "root",
            message: "Use at most 50 skills in each category.",
          });
        const texts = new Set<string>();
        group.items.forEach((item, j) => {
          const text = item.text.trim().toLowerCase();
          if (!text || item.text.length > 100 || texts.has(text))
            issues.push({
              path: `groups.${String(i)}.items.${String(j)}.text`,
              message: "Use a unique skill of 1–100 characters or remove it.",
            });
          texts.add(text);
        });
      });
    }
    if (
      ["skills", "languages"].includes(sectionFor(draft, target)?.kind ?? "")
    ) {
      if (values.languages.length > 50)
        issues.push({ path: "root", message: "Use at most 50 languages." });
      const texts = new Set<string>();
      values.languages.forEach((item, i) => {
        const text = item.text.trim().toLowerCase();
        if (!text || item.text.length > 100 || texts.has(text))
          issues.push({
            path: `languages.${String(i)}.text`,
            message: "Use a unique language of 1–100 characters or remove it.",
          });
        if (item.proficiency.length > 100)
          issues.push({
            path: `languages.${String(i)}.proficiency`,
            message: "Keep proficiency under 100 characters.",
          });
        texts.add(text);
      });
    }
  } else if (!values.item.text.trim())
    issues.push({ path: "item.text", message: "Enter text for this item." });
  return issues;
}

// Explicit demo convenience: empty fields only, exact target, no network or profile writes.
export function fillEmptyForm(
  values: EditorFormValues,
  target: DraftTarget,
  kind: DraftSection["kind"] | undefined,
  sample: ResumeDraft,
  id: () => string,
): EditorFormValues {
  const next = structuredClone(values);
  const sourceSection = sample.sections.find((s) => s.kind === kind);
  if (target.type === "header") {
    for (const field of [
      "firstName",
      "lastName",
      "headline",
      "city",
      "state",
      "country",
    ] as const)
      if (!next.header[field].trim()) next.header[field] = sample.header[field];
    for (const field of ["phone", "email"] as const)
      if (!next.sampleContact[field].trim())
        next.sampleContact[field] = sample.sampleContact[field];
    if (!next.title.trim()) next.title = sample.title;
  } else if (target.type === "entry") {
    const source = sourceSection?.entries[0];
    if (!source) return next;
    for (const field of [
      "title",
      "subtitle",
      "location",
      "employmentType",
      "locationType",
      "fieldOfStudy",
      "grade",
      "technologies",
    ] as const)
      if (!next.entry[field].trim()) next.entry[field] = source[field];
    if (
      !next.entry.dates.startYear &&
      !next.entry.dates.endYear &&
      !next.entry.dates.startMonth &&
      !next.entry.dates.endMonth &&
      !next.entry.dates.current
    )
      next.entry.dates = structuredClone(source.dates);
    if (!richTextPlain(next.entry.description).trim())
      next.entry.description = richTextPlain(source.description).trim()
        ? structuredClone(source.description)
        : {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: `Fictional sample ${kind ?? "resume"} entry for editor demonstration.`,
                  },
                ],
              },
            ],
          };
    if (!next.entry.bullets.length)
      next.entry.bullets = source.bullets.map((b) => ({ ...b, id: id() }));
    else
      next.entry.bullets.forEach((b, i) => {
        if (!b.text.trim())
          b.text =
            source.bullets[i]?.text ??
            "Synthetic example: describe a supported achievement here.";
      });
    if (!next.entry.links.length)
      next.entry.links = source.links.map((link) => ({ ...link, id: id() }));
  } else if (target.type === "section" && sourceSection) {
    if (!next.label.trim()) next.label = sourceSection.label;
    if (kind === "summary" && !richTextPlain(next.summary).trim())
      next.summary = structuredClone(sourceSection.summary);
    if (kind === "skills")
      next.groups.forEach((group) => {
        const source = sourceSection.groups.find(
          (g) => g.label.toLowerCase() === group.label.toLowerCase(),
        );
        if (!group.items.length)
          group.items = (source?.items ?? []).map((item) => ({
            ...item,
            id: id(),
          }));
        else
          group.items.forEach((item, j) => {
            if (!item.text.trim())
              item.text = source?.items[j]?.text ?? "Example skill";
          });
      });
    if (kind === "languages" || kind === "skills") {
      if (!next.languages.length)
        next.languages = sourceSection.languages.map((item) => ({
          ...item,
          id: id(),
        }));
      else
        next.languages.forEach((item, i) => {
          if (!item.text.trim()) {
            item.text = sourceSection.languages[i]?.text ?? "Example language";
            if (!item.proficiency)
              item.proficiency = sourceSection.languages[i]?.proficiency ?? "";
          }
        });
    }
  } else if (!next.item.text.trim()) {
    next.item.text =
      target.type === "language"
        ? "English"
        : target.type === "skill"
          ? "TypeScript"
          : "Synthetic example: describe a supported achievement here.";
    if (target.type === "language" && !next.proficiency)
      next.proficiency = "Fluent";
  }
  return next;
}
