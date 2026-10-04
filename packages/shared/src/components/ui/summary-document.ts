/** Local editor format only; not a persisted resume/version or contact contract. */
export type SummaryInline =
  | { type: "text"; text: string; marks?: { type: "bold" | "italic" }[] }
  | { type: "hardBreak" };
export type SummaryParagraph = { type: "paragraph"; content?: SummaryInline[] };
export interface SummaryBulletList {
  type: "bulletList";
  content: {
    type: "listItem";
    content: (SummaryParagraph | SummaryBulletList)[];
  }[];
}
export type SummaryDocument = {
  type: "doc";
  content: (SummaryParagraph | SummaryBulletList)[];
};

export function summaryFromText(text: string): SummaryDocument {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}

// Never carry arbitrary HTML, attributes, links or unknown marks into the draft.
export function normalizeSummary(value: unknown): SummaryDocument {
  const record = (node: unknown): Record<string, unknown> =>
    node !== null && typeof node === "object"
      ? (node as Record<string, unknown>)
      : {};
  const children = (node: Record<string, unknown>): unknown[] =>
    Array.isArray(node.content) ? node.content : [];
  const paragraph = (value: unknown): SummaryParagraph => {
    const content = children(record(value)).flatMap((item): SummaryInline[] => {
      const node = record(item);
      if (node.type === "hardBreak") return [{ type: "hardBreak" }];
      if (node.type !== "text" || typeof node.text !== "string" || !node.text)
        return [];
      const marks = Array.isArray(node.marks)
        ? node.marks.flatMap((mark): { type: "bold" | "italic" }[] => {
            const type = record(mark).type;
            return type === "bold" || type === "italic" ? [{ type }] : [];
          })
        : [];
      return [
        { type: "text", text: node.text, ...(marks.length ? { marks } : {}) },
      ];
    });
    return { type: "paragraph", ...(content.length ? { content } : {}) };
  };
  const blocks = (values: unknown[]): SummaryDocument["content"] =>
    values.flatMap((item): SummaryDocument["content"] => {
      const node = record(item);
      if (node.type === "paragraph") return [paragraph(node)];
      if (node.type !== "bulletList") return [];
      const items = children(node)
        .filter((item) => record(item).type === "listItem")
        .map((item) => ({
          type: "listItem" as const,
          content: blocks(children(record(item))),
        }));
      return items.length ? [{ type: "bulletList", content: items }] : [];
    });
  const content = blocks(children(record(value)));
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}
