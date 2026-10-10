import type { ReadinessInput } from "./readiness.js";
// Structural input shared by saved documents and local edit previews. No identity/contact fields.
interface RichNode { type: string; text?: string; marks?: { type: string }[]; content?: RichNode[] }
export interface ReadinessDocument {
  sections: {
    id: string; kind: string; label: string; hidden: boolean;
    summary: RichNode;
    entries: {
      id: string; hidden: boolean; title: string; subtitle: string;
      dates: ReadinessInput["sections"][number]["entries"][number]["dates"];
      technologies?: string;
      description: RichNode; bullets: { hidden: boolean; text: string }[];
    }[];
    groups: { label: string; items: { hidden: boolean; text: string }[] }[];
  }[];
}
function lines(doc: RichNode): string[] {
  const result: string[] = [];
  const visit = (blocks: RichNode[]) => {
    for (const block of blocks) {
      if (block.type === "paragraph") {
        const text = (block.content ?? [])
          .map((n) => (n.type === "text" ? n.text ?? "" : " "))
          .join("")
          .trim();
        if (text) result.push(text);
      } else for (const item of block.content ?? []) visit(item.content ?? []);
    }
  };
  visit(doc.content ?? []);
  return result;
}
/** Deliberately excludes header, contacts, extraction source, layout and hidden facts. */
export function readinessProjection(doc: ReadinessDocument): ReadinessInput {
  return {
    sections: doc.sections
      .filter((s) => !s.hidden)
      .map((s) => ({
        id: s.id,
        kind: s.kind,
        label: s.label,
        summary: lines(s.summary),
        entries: s.entries
          .filter((e) => !e.hidden)
          .map((e) => ({
            id: e.id,
            title: e.title,
            subtitle: e.subtitle,
            dates: e.dates,
            technologies: e.technologies ?? "",
            bulletCount: richStats(e.description).bullets + e.bullets.filter((b) => !b.hidden && b.text.trim()).length,
            formatting: richStats(e.description).formatting,
            details: [
              ...lines(e.description),
              ...e.bullets.filter((b) => !b.hidden).map((b) => b.text),
            ],
          })),
        groups: s.groups.map((g) => ({
          label: g.label,
          items: g.items
            .filter((i) => !i.hidden && i.text.trim())
            .map((i) => i.text),
        })),
      })),
  };
}

function richStats(doc: RichNode) {
  let characters = 0, boldCharacters = 0, bullets = 0;
  const visit = (node: RichNode) => {
    if (node.type === "listItem") bullets++;
    if (node.type === "text") {
      characters += node.text?.length ?? 0;
      if (node.marks?.some((m) => m.type === "bold")) boldCharacters += node.text?.length ?? 0;
    }
    for (const child of node.content ?? []) visit(child);
  };
  visit(doc);
  return { bullets, formatting: { characters, boldCharacters } };
}
