import { containsTerm, readinessProjection } from "@resume-forge/resume-core";
import {
  applyTailoringPreview,
  type EditorDocument,
  type TailoringChange,
} from "@resume-forge/shared-types";
import { parseJdText } from "../jd-parser.js";
import { ResumeError } from "../contracts.js";
import {
  assertContactFree,
  plain,
  rewriteFields,
  validateChanges,
} from "../ats/rewrite.js";

export function tailoringFields(doc: EditorDocument, allowEmpty = false) {
  const fields = doc.sections
    .filter((s) => !s.hidden)
    .flatMap((s) => {
      const targets =
        s.kind === "summary" && plain(s.summary).trim()
          ? [{ type: "section" as const, sectionId: s.id }]
          : ["experience", "projects"].includes(s.kind)
            ? s.entries
                .filter(
                  (e) =>
                    !e.hidden &&
                    (plain(e.description).trim() ||
                      e.bullets.some((b) => !b.hidden && b.text.trim())),
                )
                .map((e) => ({
                  type: "entry" as const,
                  sectionId: s.id,
                  itemId: e.id,
                }))
            : [];
      return targets.flatMap((target) =>
        rewriteFields(doc, target).map((f) => ({
          ...f,
          label: `${target.type === "entry" ? s.entries.find((e) => e.id === target.itemId)?.title || s.label : s.label} · ${f.label}`,
          target,
        })),
      );
    })
    .map((f, index) => ({ ...f, id: `fact-${String(index)}` }));
  if (!fields.length && !allowEmpty)
    throw new ResumeError(
      "invalid_input",
      "Add a saved professional summary, experience or project description first.",
    );
  if (
    fields.length > 200 ||
    fields.reduce((n, f) => n + f.original.length, 0) > 60000
  )
    throw new ResumeError(
      "invalid_input",
      "This resume exceeds the 200-field or 60,000-character tailoring limit. Shorten visible descriptions first.",
    );
  return fields;
}
export function fieldBatches(fields: ReturnType<typeof tailoringFields>) {
  const batches: (typeof fields)[] = [];
  let current: typeof fields = [],
    size = 0;
  for (const f of fields) {
    if (
      current.length &&
      (current.length >= 30 || size + f.original.length > 12000)
    ) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(f);
    size += f.original.length;
  }
  if (current.length) batches.push(current);
  return batches;
}
export function groundedBatch(
  doc: EditorDocument,
  batch: ReturnType<typeof tailoringFields>,
  output: { field: string; proposed: string }[],
): TailoringChange[] {
  if (
    new Set(output.map((c) => c.field)).size !== output.length ||
    output.some((c) => !batch.some((f) => f.id === c.field))
  )
    throw new ResumeError(
      "invalid_input",
      "AI returned an unknown or repeated field. Retry the tailoring request.",
    );
  return output.flatMap((c) => {
    const f = batch.find((f) => f.id === c.field);
    if (!f) throw new ResumeError("invalid_input");
    const validated = validateChanges(doc, f.target, [
      { field: f.field, proposed: c.proposed },
    ]);
    return validated.map((v) => ({
      ...v,
      id: f.id,
      kind: "text" as const,
      target: f.target,
      label: f.label,
      facts: [f.id],
      evidence: [f.original],
    }));
  });
}

export function localAssessment(
  doc: EditorDocument,
  text: string,
  now: number,
) {
  const jd = parseJdText(text),
    projection = readinessProjection(doc);
  // Parsed terms are intake hints only. They are not a calibrated assessment.
  const visible = JSON.stringify(projection);
  const names = (matched: boolean) => [
    ...new Set(
      jd.keywords
        .filter((keyword) => containsTerm(visible, keyword.name) === matched)
        .map((keyword) => keyword.name),
    ),
  ];
  const years = text.match(
    /\b(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s*\+?\s*years?\b/i,
  );
  const statedYears = years && Number(years[1]) <= 60 ? Number(years[1]) : null;
  const currentMonth =
    new Date(now).getUTCFullYear() * 12 + new Date(now).getUTCMonth();
  const experience = doc.sections
    .filter((s) => !s.hidden && s.kind === "experience")
    .flatMap((s) => s.entries.filter((e) => !e.hidden));
  const ranges = experience.map((e) => {
    const d = e.dates;
    if (
      !d.startYear ||
      !d.startMonth ||
      (!d.current && (!d.endYear || !d.endMonth))
    )
      return null;
    const start = Number(d.startYear) * 12 + Number(d.startMonth) - 1;
    const end = d.current
      ? currentMonth
      : Number(d.endYear) * 12 + Number(d.endMonth) - 1;
    return start <= end && end <= currentMonth
      ? ([start, end + 1] as const)
      : null;
  });
  let months = 0,
    last = -1;
  for (const r of ranges
    .filter((r): r is readonly [number, number] => r !== null)
    .sort((a, b) => a[0] - b[0])) {
    months += Math.max(0, r[1] - Math.max(last, r[0]));
    last = Math.max(last, r[1]);
  }
  return {
    jd,
    analysis: {
      score: null,
      matched: names(true),
      missing: names(false),
      statedYears,
      datedYears:
        ranges.length && ranges.every(Boolean)
          ? Math.round((months / 12) * 10) / 10
          : null,
      experienceLevel: jd.experienceLevel ?? "unknown",
    },
  };
}

/** Reorders only supported content; work history chronology and hidden positions stay intact. */
export function orderingChanges(
  doc: EditorDocument,
  jdText: string,
  reorderSections = false,
): TailoringChange[] {
  const jd = parseJdText(jdText),
    result: TailoringChange[] = [];
  const rank = (text: string) =>
    jd.keywords.reduce(
      (n, k) => n + (containsTerm(text, k.name) ? (k.required ? 2 : 1) : 0),
      0,
    );
  if (reorderSections) {
    const visible = doc.sections.filter((s) => !s.hidden);
    const priorities = {
      summary: 0,
      experience: 1,
      projects: 2,
      skills: 3,
      education: 4,
      languages: 5,
    };
    const sorted = [...visible].sort(
      (a, b) => priorities[a.kind] - priorities[b.kind],
    );
    if (visible.some((s, i) => s.id !== sorted[i]?.id))
      result.push({
        id: "order:document:sections",
        kind: "order",
        scope: "sections",
        sectionId: "document",
        parentId: null,
        label: "Resume structure · professional evidence first",
        original: visible.map((s) => s.label).join("\n"),
        proposed: sorted.map((s) => s.label).join("\n"),
        originalIds: visible.map((s) => s.id),
        proposedIds: sorted.map((s) => s.id),
        facts: visible.map((s) => s.id),
        evidence: visible.map((s) => s.label),
      });
  }
  const order = (
    scope: "projects" | "bullets" | "skills",
    sectionId: string,
    parentId: string | null,
    label: string,
    values: { id: string; text: string; hidden: boolean }[],
  ) => {
    const visible = values.filter((v) => !v.hidden),
      sorted = [...visible].sort((a, b) => rank(b.text) - rank(a.text));
    if (visible.some((v, i) => v.id !== sorted[i]?.id))
      result.push({
        id: `order:${sectionId}:${parentId ?? "section"}`,
        kind: "order",
        scope,
        sectionId,
        parentId,
        label,
        original: visible.map((v) => v.text).join("\n"),
        proposed: sorted.map((v) => v.text).join("\n"),
        originalIds: visible.map((v) => v.id),
        proposedIds: sorted.map((v) => v.id),
        facts: visible.map((v) => v.id),
        evidence: visible.map((v) => v.text),
      });
  };
  for (const s of doc.sections.filter((s) => !s.hidden)) {
    if (s.kind === "projects")
      order(
        "projects",
        s.id,
        null,
        "Projects · relevance order",
        s.entries.map((e) => ({
          id: e.id,
          hidden: e.hidden,
          text: `${e.title}\n${plain(e.description)}\n${e.technologies}`,
        })),
      );
    if (["experience", "projects"].includes(s.kind))
      for (const e of s.entries.filter((e) => !e.hidden))
        order(
          "bullets",
          s.id,
          e.id,
          `${e.title || s.label} · achievement order`,
          e.bullets,
        );
    if (s.kind === "skills")
      for (const g of s.groups)
        order(
          "skills",
          s.id,
          g.id,
          `${g.label || "Skills"} · relevance order`,
          g.items,
        );
  }
  return result;
}

/** A new summary is assembled from complete verified source sentences, never freeform model claims. */
export function summaryChange(
  doc: EditorDocument,
  jdText: string,
  edits: TailoringChange[],
): TailoringChange[] {
  const section = doc.sections.find((s) => !s.hidden && s.kind === "summary");
  if (!section) return [];
  const jd = parseJdText(jdText),
    fields = tailoringFields(doc);
  const candidates = fields
    .filter((f) => f.target.type === "entry")
    .flatMap((f) => {
      const text = edits.find((c) => c.id === f.id)?.proposed ?? f.original;
      return text
        .split("\n")
        .map((line) => ({ text: line.trim(), fact: f.id }));
    })
    .filter(
      (f) =>
        f.text.split(/\s+/).length >= 5 && f.text.split(/\s+/).length <= 50,
    )
    .map((f) => ({
      ...f,
      score: jd.keywords.filter((k) => containsTerm(f.text, k.name)).length,
    }))
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((f, i, all) => all.findIndex((v) => v.text === f.text) === i)
    .slice(0, 2);
  if (!candidates.length) return [];
  const proposed = candidates.map((c) => c.text).join("\n"),
    original = plain(section.summary);
  if (
    original.replace(/\s+/g, " ").trim() ===
    proposed.replace(/\s+/g, " ").trim()
  )
    return [];
  assertContactFree(proposed, doc);
  return [
    {
      id: "supported-summary",
      kind: "text",
      label: "Summary · supported strengths",
      target: { type: "section", sectionId: section.id },
      field: "summary",
      original,
      proposed,
      facts: candidates.map((c) => c.fact),
      evidence: candidates.map(
        (c) => fields.find((f) => f.id === c.fact)?.original ?? c.text,
      ),
    },
  ];
}
export function completeChanges(
  doc: EditorDocument,
  jdText: string,
  edits: TailoringChange[],
) {
  const summary = summaryChange(doc, jdText, edits);
  const text = summary.length
    ? edits.filter(
        (c) =>
          !(
            c.kind === "text" &&
            c.target.type === "section" &&
            c.field === "summary"
          ),
      )
    : edits;
  const rewritten = applyTailoringPreview(
    doc,
    text,
    text.map((c) => c.id),
  );
  return [...text, ...summary, ...orderingChanges(rewritten, jdText)];
}
