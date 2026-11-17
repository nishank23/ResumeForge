import {
  PDF_READABILITY_ENGINE,
  readabilityAnalysisSchema,
  type ReadabilityAnalysis,
  type EditorDocument,
} from "@resume-forge/shared-types";
import { readabilityContent } from "./readability-content.js";

// Normalize presentation differences while retaining meaningful C++, C# and %.
const tokens = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/[\u00ad\u200b-\u200d\ufeff]/gu, "")
    .toLocaleLowerCase("en")
    .match(/[\p{L}\p{N}]+|[+#%]/gu) ?? [];
export function comparePdfReadability(
  doc: EditorDocument,
  pages: ReadabilityAnalysis["pages"],
): ReadabilityAnalysis {
  const blocks = readabilityContent(doc)
    .map((block) => ({ ...block, tokens: tokens(block.text) }))
    .filter((block) => block.tokens.length);
  const actual = tokens(pages.map((page) => page.text).join("\n"));
  if (
    actual.length > 50000 ||
    blocks.reduce((n, item) => n + item.tokens.length, 0) > 50000
  )
    throw new Error("Readability comparison exceeds bounds.");
  const issues = new Map<string, ReadabilityAnalysis["issues"][number]>();
  function issue(
    kind: ReadabilityAnalysis["issues"][number]["kind"],
    block: (typeof blocks)[number],
  ) {
    const key = `${kind}:${block.sectionId ?? "header"}`;
    const item = issues.get(key) ?? {
      kind,
      label: block.label,
      ...(block.sectionId ? { sectionId: block.sectionId } : {}),
      affectedBlocks: 0,
      excerpts: [],
    };
    item.affectedBlocks++;
    if (item.excerpts.length < 3) item.excerpts.push(block.text.slice(0, 240));
    issues.set(key, item);
  }
  if (!actual.length || !blocks.length)
    return readabilityAnalysisSchema.parse({
      engineVersion: PDF_READABILITY_ENGINE,
      status: "needs_review",
      checkedBlocks: blocks.length,
      recoveredBlocks: 0,
      pages,
      issues: [
        {
          kind: "no_text",
          label: "Entire resume",
          affectedBlocks: Math.max(1, blocks.length),
          excerpts: [],
        },
      ],
    });
  const positions = new Map<string, number[]>();
  actual.forEach((word, index) => {
    const list = positions.get(word) ?? [];
    list.push(index);
    positions.set(word, list);
  });
  const used = new Uint8Array(actual.length);
  let recovered = 0,
    previousEnd = 0,
    groupEnd = 0,
    currentGroup = -1;
  const unmatched: typeof blocks = [];
  for (const block of blocks) {
    if (block.group !== currentGroup) {
      previousEnd = Math.max(previousEnd, groupEnd);
      groupEnd = previousEnd;
      currentGroup = block.group;
    }
    const candidates = positions.get(block.tokens[0] ?? "") ?? [];
    const matches = (start: number) =>
      block.tokens.every(
        (word, offset) =>
          actual[start + offset] === word && !used[start + offset],
      );
    const start =
      candidates.find((at) => at >= previousEnd && matches(at)) ??
      candidates.find(matches);
    if (start === undefined) {
      unmatched.push(block);
      continue;
    }
    for (let i = start; i < start + block.tokens.length; i++) used[i] = 1;
    if (start < previousEnd) issue("reading_order", block);
    groupEnd = Math.max(groupEnd, start + block.tokens.length);
    recovered++;
  }
  // Allocate remaining occurrences so duplicated content cannot be credited twice.
  const remaining = new Map<string, number>();
  actual.forEach((word, i) => {
    if (!used[i]) remaining.set(word, (remaining.get(word) ?? 0) + 1);
  });
  for (const block of unmatched) {
    let missing = false;
    for (const word of block.tokens) {
      const count = remaining.get(word) ?? 0;
      if (count) remaining.set(word, count - 1);
      else missing = true;
    }
    issue(missing ? "missing_text" : "reading_order", block);
  }
  return readabilityAnalysisSchema.parse({
    engineVersion: PDF_READABILITY_ENGINE,
    status: issues.size ? "needs_review" : "readable",
    checkedBlocks: blocks.length,
    recoveredBlocks: recovered,
    pages,
    issues: [...issues.values()],
  });
}
