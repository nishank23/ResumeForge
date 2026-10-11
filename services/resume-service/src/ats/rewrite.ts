import type {
  EditorDocument,
  RewriteTarget,
  RewriteProposal,
} from "@resume-forge/shared-types";
import { editorDocumentSchema } from "@resume-forge/shared-types";
import { AiUnavailable } from "./ai.js";
import {
  REWRITE_GRAMMAR,
  canonicalRewriteWord,
  canonicalRewriteText,
  REWRITE_PROTECTED_CLAIMS,
} from "./rewrite-vocabulary.js";
type Rich = EditorDocument["sections"][number]["summary"];
export function plain(node: {
  type: string;
  text?: string;
  content?: unknown[];
}): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? [])
    .map((v) => plain(v as Parameters<typeof plain>[0]))
    .join(["doc", "bulletList"].includes(node.type) ? "\n" : "");
}
const rich = (text: string): Rich => ({
  type: "doc",
  content: text.split("\n").map((v) => ({
    type: "paragraph",
    content: v ? [{ type: "text", text: v }] : [],
  })),
});
export function rewriteFields(doc: EditorDocument, target: RewriteTarget) {
  const section = doc.sections.find(
    (s) => s.id === target.sectionId && !s.hidden,
  );
  if (!section)
    throw new AiUnavailable(
      "This section is no longer visible. Reopen the resume.",
    );
  const fields: { field: string; label: string; original: string }[] = [];
  if (target.type === "section" && section.kind === "summary")
    fields.push({
      field: "summary",
      label: "Summary",
      original: plain(section.summary),
    });
  else if (
    target.type === "entry" &&
    ["experience", "projects"].includes(section.kind)
  ) {
    const entry = section.entries.find(
      (e) => e.id === target.itemId && !e.hidden,
    );
    if (!entry)
      throw new AiUnavailable(
        "This entry is no longer present. Reopen the resume.",
      );
    fields.push({
      field: "description",
      label: "Description",
      original: plain(entry.description),
    });
    entry.bullets
      .filter((b) => !b.hidden)
      .forEach((b, i) =>
        fields.push({
          field: `bullet:${b.id}`,
          label: `Achievement ${String(i + 1)}`,
          original: b.text,
        }),
      );
  } else
    throw new AiUnavailable(
      "AI wording fixes support Summary, Work experience entries and Projects. Edit this field manually.",
    );
  const visible = fields.filter((f) => f.original.trim());
  if (!visible.length)
    throw new AiUnavailable(
      "Add your real description or achievements, then save before requesting AI wording changes.",
    );
  if (
    visible.length > 30 ||
    visible.reduce((n, f) => n + f.original.length, 0) > 12000
  )
    throw new AiUnavailable(
      "This entry is too large for a bounded rewrite. Shorten it manually first.",
    );
  assertContactFree(visible.map((f) => f.original).join("\n"), doc);
  return visible;
}
export function assertContactFree(text: string, doc: EditorDocument) {
  const known = [
    doc.sampleContact.email,
    doc.sampleContact.phone,
    ...(doc.header.links ?? []).map((l) => l.url),
  ].filter((v) => v.trim().length >= 3);
  if (
    known.some((v) => text.toLowerCase().includes(v.toLowerCase())) ||
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|(?:\+\d[\d ()-]{6,}\d)/i.test(text)
  )
    throw new AiUnavailable(
      "Remove contact details or links from professional descriptions before sending them to AI.",
    );
}
const grammar = new Set(REWRITE_GRAMMAR.split(" "));
const words = (text: string) =>
  (
    canonicalRewriteText(text)
      .toLowerCase()
      .match(/[\p{L}][\p{L}\p{N}+#.-]*/gu) ?? []
  ).map((word) => canonicalRewriteWord(word.replace(/[.-]+$/, "")));
const numbers = (text: string) =>
  (text.match(/\d+(?:[.,]\d+)*(?:%|[kKmMbB])?/g) ?? []).sort();
export function validateChanges(
  doc: EditorDocument,
  target: RewriteTarget,
  changes: { field: string; proposed: string }[],
) {
  const fields = rewriteFields(doc, target);
  const seen = new Set<string>();
  return changes
    .map((change) => {
      const source = fields.find((f) => f.field === change.field);
      if (
        !source ||
        seen.has(change.field) ||
        !change.proposed.trim() ||
        change.proposed.length > 10000 ||
        /[<>]/.test(change.proposed)
      )
        throw new AiUnavailable(
          "AI changed an unsupported field. Edit manually or retry.",
        );
      seen.add(change.field);
      assertContactFree(change.proposed, doc);
      const sourceLines = source.original
        .split("\n")
        .filter((line) => line.trim());
      const proposedLines = change.proposed
        .split("\n")
        .filter((line) => line.trim());
      if (
        sourceLines.length !== proposedLines.length ||
        sourceLines.some((original, index) => {
          const proposed = proposedLines[index] ?? "";
          const slashTerms =
            original.match(/[\p{L}\p{N}.+#-]+(?:\/[\p{L}\p{N}.+#-]+)+/gu) ?? [];
          const vocabulary = new Set(words(original));
          const proposedVocabulary = new Set(words(proposed));
          return (
            slashTerms.some((term) => !proposed.includes(term)) ||
            JSON.stringify(numbers(original)) !==
              JSON.stringify(numbers(proposed)) ||
            [...proposedVocabulary].some(
              (word) => !vocabulary.has(word) && !grammar.has(word),
            ) ||
            [...vocabulary].some(
              (word) => !grammar.has(word) && !proposedVocabulary.has(word),
            ) ||
            REWRITE_PROTECTED_CLAIMS.some(
              (group) =>
                group.some((word) => proposedVocabulary.has(word)) !==
                group.some((word) => vocabulary.has(word)),
            )
          );
        })
      )
        throw new AiUnavailable(
          "AI introduced unsupported facts or wording. Edit manually or retry.",
        );
      return { ...source, proposed: change.proposed };
    })
    .filter(
      (change) =>
        change.original.replace(/\s+/g, " ").trim() !==
        change.proposed.replace(/\s+/g, " ").trim(),
    );
}
export function applyRewrite(
  doc: EditorDocument,
  proposal: RewriteProposal,
): EditorDocument {
  const next = structuredClone(doc);
  const section = next.sections.find((s) => s.id === proposal.target.sectionId);
  if (!section) throw new AiUnavailable();
  const target = proposal.target;
  for (const change of validateChanges(doc, target, proposal.changes)) {
    if (target.type === "section" && change.field === "summary")
      section.summary = rich(change.proposed);
    else if (target.type === "entry") {
      const entry = section.entries.find((e) => e.id === target.itemId);
      if (!entry) throw new AiUnavailable();
      if (change.field === "description")
        entry.description = rich(change.proposed);
      else {
        const bullet = entry.bullets.find(
          (b) => `bullet:${b.id}` === change.field,
        );
        if (!bullet) throw new AiUnavailable();
        bullet.text = change.proposed;
      }
    }
  }
  return editorDocumentSchema.parse(next);
}
