import { z } from "zod";
import { containsTerm } from "@resume-forge/resume-core";
import {
  applyTailoringPreview,
  tailoringFactsSchema,
  tailoringAnswerIssue,
  tailoringSectionId,
  type EditorDocument,
  type TailoringChange,
  type TailoringFact,
} from "@resume-forge/shared-types";
import { ResumeError } from "../contracts.js";
import { assertContactFree, plain } from "../ats/rewrite.js";
import { parseJdText } from "../jd-parser.js";
import { orderingChanges, tailoringFields } from "./facts.js";

const fieldId = z.string().min(1).max(100);
export const fullTailoringOutputSchema = z
  .object({
    changes: z
      .array(
        z
          .object({
            field: fieldId,
            proposed: z.string().max(20000),
            facts: z.array(fieldId).min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type FullTailoringOutput = z.infer<typeof fullTailoringOutputSchema>;
export const tailoringVerificationSchema = z
  .object({
    checks: z
      .array(
        z
          .object({
            field: fieldId,
            supported: z.boolean(),
            complete: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type TailoringVerification = z.infer<typeof tailoringVerificationSchema>;
const words = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;
const numbers = (text: string) =>
  text.match(/\b\d+(?:[.,]\d+)*\s*%?/g)?.map((v) => v.replace(/\s/g, "")) ?? [];
function professionalOnly(text: string, doc: EditorDocument) {
  assertContactFree(text, doc);
  const identity = [doc.header.firstName, doc.header.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (
    identity.length > 3 &&
    text.toLowerCase().includes(identity.toLowerCase())
  )
    throw new ResumeError(
      "invalid_input",
      "Remove personal identity from professional prose before tailoring.",
    );
}

/** Complete visible prose, with opaque IDs and entry-local professional context. No source/header/contact projection. */
export interface TailoringEvidence {
  additionalFacts?: TailoringFact[];
  complete?: boolean;
}
function factEntry(doc: EditorDocument, fact: TailoringFact) {
  const entry = doc.sections
    .find(
      (s) =>
        s.id === fact.sectionId &&
        !s.hidden &&
        ["experience", "projects"].includes(s.kind),
    )
    ?.entries.find((e) => e.id === fact.itemId && !e.hidden);
  if (!entry)
    throw new ResumeError(
      "invalid_input",
      "An experience answer targets an unavailable entry. Reopen the saved resume.",
    );
  return entry;
}
export function validateAdditionalFacts(
  doc: EditorDocument,
  input: TailoringFact[],
) {
  const facts = tailoringFactsSchema.parse(input);
  for (const fact of facts) {
    const issue = tailoringAnswerIssue(fact.text);
    if (issue) throw new ResumeError("invalid_input", issue);
    factEntry(doc, fact);
    professionalOnly(fact.text, doc);
    if (
      fact.kind === "tools" &&
      (fact.text.length > 500 ||
        fact.text
          .split(/[,;\n]/)
          .some((v) => !v.trim() || v.trim().length > 60))
    )
      throw new ResumeError(
        "invalid_input",
        "List actual tools separated by commas, using 60 characters or fewer per tool.",
      );
  }
  return facts;
}
export function fullTailoringSource(
  doc: EditorDocument,
  evidence: TailoringEvidence = {},
) {
  const additionalFacts = validateAdditionalFacts(
    doc,
    evidence.additionalFacts ?? [],
  );
  const fields = tailoringFields(doc, additionalFacts.length > 0);
  for (const f of additionalFacts) {
    if (
      fields.some(
        (v) =>
          v.target.type === "entry" &&
          v.target.sectionId === f.sectionId &&
          v.target.itemId === f.itemId &&
          v.field === "description",
      )
    )
      continue;
    const entry = factEntry(doc, f);
    fields.push({
      id: `additional-description-${String(fields.length)}`,
      field: "description",
      label: `${entry.title || "Experience"} · Description`,
      original: plain(entry.description),
      target: { type: "entry", sectionId: f.sectionId, itemId: f.itemId },
    });
  }
  if (
    evidence.complete &&
    !doc.sections.some((s) => !s.hidden && s.kind === "summary") &&
    doc.sections.length < 30
  )
    fields.unshift({
      id: "added-summary",
      field: "summary",
      label: "Professional summary",
      original: "",
      target: {
        type: "section",
        sectionId: tailoringSectionId(doc, "summary"),
      },
    });
  for (const s of doc.sections.filter(
    (s) => !s.hidden && s.kind === "summary",
  )) {
    if (!plain(s.summary).trim())
      fields.unshift({
        id: `summary-${String(fields.length)}`,
        field: "summary",
        label: s.label,
        original: "",
        target: { type: "section", sectionId: s.id },
      });
  }
  const entryScopes = new Map<string, string>();
  for (const f of fields)
    if (f.target.type === "entry") {
      const key = JSON.stringify([f.target.sectionId, f.target.itemId]);
      if (!entryScopes.has(key))
        entryScopes.set(key, `entry-${String(entryScopes.size)}`);
    }
  const scope = (f: (typeof fields)[number]) => {
    if (f.target.type !== "entry") return "summary";
    const value = entryScopes.get(
      JSON.stringify([f.target.sectionId, f.target.itemId]),
    );
    if (!value) throw new ResumeError("invalid_input");
    return value;
  };
  const facts = fields
    .filter((f) => f.original.trim())
    .map((f) => ({
      id: f.id,
      scope: scope(f),
      text: f.original,
      origin: "saved-resume",
    }));
  additionalFacts.forEach((f, index) => {
    const entryScope = entryScopes.get(JSON.stringify([f.sectionId, f.itemId]));
    if (!entryScope) throw new ResumeError("invalid_input");
    facts.push({
      id: `confirmed-${String(index)}`,
      scope: entryScope,
      text: f.text,
      origin: "user-confirmed",
    });
  });
  const contexts: { scope: string; kind: string; facts: string[] }[] = [];
  for (const s of doc.sections.filter((s) => !s.hidden)) {
    if (["experience", "projects"].includes(s.kind))
      for (const e of s.entries.filter((e) => !e.hidden)) {
        const entryScope = entryScopes.get(JSON.stringify([s.id, e.id]));
        if (!entryScope) continue;
        if (!fields.some((f) => scope(f) === entryScope)) continue;
        const ids: string[] = [];
        // Titles are professional context; employer, location, dates and links stay server-side.
        for (const [key, text] of [
          ["role", e.title],
          ["tools", e.technologies],
        ] as const)
          if (text.trim()) {
            const id = `context-${String(contexts.length)}-${key}`;
            facts.push({ id, scope: entryScope, text, origin: "saved-resume" });
            ids.push(id);
          }
        contexts.push({ scope: entryScope, kind: s.kind, facts: ids });
      }
    if (s.kind === "skills")
      for (const g of s.groups)
        for (const i of g.items.filter((i) => !i.hidden && i.text.trim()))
          facts.push({
            id: `skill-${String(facts.length)}`,
            scope: "skills",
            text: i.text,
            origin: "saved-resume",
          });
  }
  for (const f of facts) professionalOnly(f.text, doc);
  if (
    fields.length > 200 ||
    facts.length > 600 ||
    JSON.stringify(facts).length > 90000
  )
    throw new ResumeError(
      "invalid_input",
      "Professional facts exceed the full-tailoring limit. Shorten visible descriptions first.",
    );
  return {
    fields,
    provider: {
      fields: fields.map((f) => ({
        field: f.id,
        scope: scope(f),
        original: f.original,
        kind: f.field === "summary" ? "summary" : "description",
        expandable:
          f.field === "description" &&
          facts.some(
            (p) => p.scope === scope(f) && p.origin === "user-confirmed",
          ),
      })),
      facts,
      contexts,
    },
  };
}
export type FullTailoringSource = ReturnType<
  typeof fullTailoringSource
>["provider"];

/** Deterministic bounds precede a separate semantic audit. Failed fields retain their saved originals. */
export function inspectFullDraft(
  doc: EditorDocument,
  output: FullTailoringOutput,
  evidence: TailoringEvidence = {},
) {
  const source = fullTailoringSource(doc, evidence),
    rows = fullTailoringOutputSchema.parse(output).changes;
  if (
    rows.length !== source.fields.length ||
    new Set(rows.map((r) => r.field)).size !== rows.length ||
    source.fields.some((f) => !rows.some((r) => r.field === f.id))
  )
    throw new ResumeError(
      "invalid_input",
      "AI did not cover every professional field. Retry full tailoring.",
    );
  const rejected: string[] = [];
  const changes = source.fields.map((f) => {
    const row = rows.find((r) => r.field === f.id);
    const providerField = source.provider.fields.find((p) => p.field === f.id);
    if (!row || !providerField) throw new ResumeError("invalid_input");
    const scope = providerField.scope;
    const allowed = source.provider.facts.filter(
      (p) => scope === "summary" || p.scope === scope,
    );
    const cited = allowed.filter((p) => row.facts.includes(p.id));
    try {
      if (
        !row.proposed.trim() ||
        /[<>]/.test(row.proposed) ||
        new Set(row.facts).size !== row.facts.length ||
        cited.length !== row.facts.length ||
        (scope !== "summary" && f.original.trim() && !row.facts.includes(f.id))
      )
        throw new Error();
      professionalOnly(row.proposed, doc);
      if (
        scope !== "summary" &&
        /\b(?:not|never|without|no)\b/i.test(f.original) &&
        !/\b(?:not|never|without|no)\b/i.test(row.proposed)
      )
        throw new Error();
      if (
        scope !== "summary" &&
        !providerField.expandable &&
        row.proposed.split("\n").length !== f.original.split("\n").length
      )
        throw new Error();
      if (f.field.startsWith("bullet:") && row.proposed.length > 2000)
        throw new Error();
      const supported = cited.map((p) => p.text).join("\n");
      if (
        providerField.expandable &&
        row.proposed.split("\n").length >
          Math.max(8, f.original.split("\n").length)
      )
        throw new Error();
      if (numbers(row.proposed).some((n) => !numbers(supported).includes(n)))
        throw new Error();
      if (
        scope !== "summary" &&
        numbers(f.original).some((n) => !numbers(row.proposed).includes(n))
      )
        throw new Error();
      const technologies = parseJdText(row.proposed).keywords.filter((k) =>
        ["technical", "tools"].includes(k.category),
      );
      if (technologies.some((k) => !containsTerm(supported, k.name)))
        throw new Error();
      // Do not solve a thin resume by padding, or silently turn a full description into a fragment.
      if (
        scope !== "summary" &&
        words(f.original) >= 20 &&
        words(row.proposed) < Math.ceil(words(f.original) * 0.7)
      )
        throw new Error();
      if (words(row.proposed) > Math.max(90, words(supported) * 1.5))
        throw new Error();
      return row;
    } catch {
      rejected.push(f.id);
      return { field: f.id, proposed: f.original, facts: [f.id] };
    }
  });
  return { changes, rejected };
}

export function verifiedFullChanges(
  doc: EditorDocument,
  jd: string,
  output: FullTailoringOutput,
  verification: TailoringVerification,
  evidence: TailoringEvidence = {},
) {
  const source = fullTailoringSource(doc, evidence),
    inspected = inspectFullDraft(doc, output, evidence);
  const checks = tailoringVerificationSchema.parse(verification).checks;
  if (
    checks.length !== source.fields.length ||
    new Set(checks.map((c) => c.field)).size !== checks.length ||
    source.fields.some((f) => !checks.some((c) => c.field === f.id))
  )
    throw new ResumeError(
      "invalid_input",
      "AI fact review was incomplete. Retry full tailoring.",
    );
  const retained = new Set(inspected.rejected);
  const edits: TailoringChange[] = inspected.changes.flatMap((row) => {
    const f = source.fields.find((f) => f.id === row.field);
    const check = checks.find((c) => c.field === row.field);
    if (!f || !check) throw new ResumeError("invalid_input");
    if (!check.supported || !check.complete) {
      retained.add(f.id);
      return [];
    }
    if (
      row.proposed.replace(/\s+/g, " ").trim() ===
      f.original.replace(/\s+/g, " ").trim()
    )
      return [];
    return [
      {
        id: f.id,
        kind: "text",
        target: f.target,
        field: f.field,
        label: f.label,
        original: f.original,
        proposed: row.proposed,
        facts: row.facts,
        evidence: source.provider.facts
          .filter((p) => row.facts.includes(p.id))
          .map((p) => p.text),
      },
    ];
  });
  const toolFacts = (evidence.additionalFacts ?? []).filter(
    (f) => f.kind === "tools",
  );
  for (const fact of toolFacts) {
    const entry = factEntry(doc, fact);
    const tools = fact.text.split(/[,;\n]/).map((v) => v.trim());
    const existing = entry.technologies
      .split(/[,;\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    const added = tools.filter(
      (t) => !existing.some((v) => v.toLowerCase() === t.toLowerCase()),
    );
    const proposed = [...existing, ...added].join(", ");
    if (added.length && proposed.length <= 500)
      edits.push({
        id: `confirmed-tools-${String(edits.length)}`,
        kind: "text",
        target: {
          type: "entry",
          sectionId: fact.sectionId,
          itemId: fact.itemId,
        },
        field: "technologies",
        label: `${entry.title || "Experience"} · Tools`,
        original: entry.technologies,
        proposed,
        facts: [
          `confirmed-${String((evidence.additionalFacts ?? []).indexOf(fact))}`,
        ],
        evidence: [fact.text],
      });
  }
  const skillSection = doc.sections.find(
    (s) => !s.hidden && s.kind === "skills",
  );
  const existingSkills = new Set(
    doc.sections
      .filter((s) => s.kind === "skills")
      .flatMap((s) =>
        s.groups.flatMap((g) => g.items.map((i) => i.text.toLowerCase())),
      ),
  );
  const newSkills = [
    ...new Set(
      toolFacts.flatMap((f) => f.text.split(/[,;\n]/).map((t) => t.trim())),
    ),
  ].filter((t) => !existingSkills.has(t.toLowerCase()));
  if (newSkills.length && (skillSection || doc.sections.length < 29))
    edits.push({
      id: "confirmed-skills",
      kind: "text",
      target: {
        type: "section",
        sectionId: skillSection?.id ?? tailoringSectionId(doc, "skills"),
      },
      field: "skills",
      label: "Skills · confirmed tools",
      original: "",
      proposed: newSkills.join("\n"),
      facts: toolFacts.map(
        (f) =>
          `confirmed-${String((evidence.additionalFacts ?? []).indexOf(f))}`,
      ),
      evidence: toolFacts.map((f) => f.text),
    });
  const preview = applyTailoringPreview(
    doc,
    edits,
    edits.map((c) => c.id),
  );
  const sourceWords = source.fields.reduce((n, f) => n + words(f.original), 0);
  const proposedWords = source.fields.reduce(
    (n, f) =>
      n + words(edits.find((c) => c.id === f.id)?.proposed ?? f.original),
    0,
  );
  return {
    changes: [
      ...edits,
      ...orderingChanges(preview, jd, true).filter(
        (c) =>
          c.kind !== "order" ||
          (c.scope === "sections"
            ? preview.sections.length === doc.sections.length
            : c.scope !== "skills" || !newSkills.length),
      ),
    ],
    quality: {
      sourceWords,
      proposedWords,
      fieldsChecked: source.fields.length,
      fieldsRewritten: edits.filter(
        (c) =>
          c.kind === "text" && !["technologies", "skills"].includes(c.field),
      ).length,
      retainedOriginal: retained.size,
    },
    warnings: [
      ...(sourceWords < 150 && !evidence.additionalFacts?.length
        ? [
            "This source has fewer than 150 professional words. Add your actual responsibilities, tools and results in the editor, save, then tailor again. AI cannot invent missing experience to fill a page.",
          ]
        : []),
      ...(retained.size
        ? [
            `Kept ${String(retained.size)} original fields because the proposed wording failed fact or coverage checks. Review those entries manually.`,
          ]
        : []),
    ],
  };
}
