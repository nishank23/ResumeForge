import type { EditorDocument, RichDocument } from "@resume-forge/shared-types";

export interface ReadabilityBlock {
  text: string;
  label: string;
  sectionId?: string;
  group: number;
}
function paragraphs(doc: RichDocument): string[] {
  const walk = (blocks: RichDocument["content"]): string[] =>
    blocks.flatMap((block): string[] => {
      if (block.type === "bulletList")
        return block.content.flatMap((item) => walk(item.content));
      return [
        (block.content ?? [])
          .map((node) => (node.type === "hardBreak" ? "\n" : node.text))
          .join(""),
      ];
    });
  return walk(doc.content).filter((text) => text.trim());
}
const months = [
  "",
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
function dates(
  d: EditorDocument["sections"][number]["entries"][number]["dates"],
) {
  const start = [!d.yearOnly && months[Number(d.startMonth)], d.startYear]
    .filter(Boolean)
    .join(" ");
  const end = d.current
    ? "Present"
    : [!d.yearOnly && months[Number(d.endMonth)], d.endYear]
        .filter(Boolean)
        .join(" ");
  return [start, end].filter(Boolean).join(" – ");
}
/** Expected visible saved content, independently of PDF drawing/extraction.
 * Metadata within one row may be read in either order; prose groups retain order.
 * This is an owner-only local projection. It is never an AI input.
 */
export function readabilityContent(doc: EditorDocument): ReadabilityBlock[] {
  const result: ReadabilityBlock[] = [];
  let group = 0;
  function add(texts: string[], label: string, sectionId?: string) {
    for (const text of texts)
      if (text.trim()) result.push({ text, label, sectionId, group });
    group++;
  }
  const header = doc.header;
  add(
    [
      [header.firstName, header.lastName].filter(Boolean).join(" "),
      header.headline,
      doc.sampleContact.phone,
      doc.sampleContact.email,
      [header.city, header.state, header.country].filter(Boolean).join(", "),
      ...(header.links ?? [])
        .filter((link) => link.url)
        .map((link) => link.label || link.url),
    ],
    "Name and contact details",
  );
  for (const section of doc.sections.filter((section) => !section.hidden)) {
    const summary = paragraphs(section.summary);
    const entries = section.entries.filter(
      (entry) =>
        !entry.hidden &&
        (entry.title ||
          entry.subtitle ||
          entry.employmentType ||
          entry.fieldOfStudy ||
          entry.location ||
          entry.grade ||
          paragraphs(entry.description).length ||
          entry.technologies ||
          entry.links.some((link) => link.url) ||
          entry.bullets.some((bullet) => !bullet.hidden && bullet.text)),
    );
    const groups = section.groups
      .map((item) => ({
        ...item,
        items: item.items.filter((tag) => !tag.hidden && tag.text),
      }))
      .filter((item) => item.items.length);
    const languages = section.languages.filter(
      (item) => !item.hidden && item.text,
    );
    if (
      !summary.length &&
      !entries.length &&
      !groups.length &&
      !languages.length
    )
      continue;
    add([section.label], section.label, section.id);
    for (const paragraph of summary)
      add([paragraph], section.label, section.id);
    for (const entry of entries) {
      add(
        [
          entry.title,
          entry.employmentType,
          entry.fieldOfStudy,
          dates(entry.dates),
          entry.subtitle,
          [entry.locationType, entry.location].filter(Boolean).join(" · "),
          entry.grade,
        ],
        section.label,
        section.id,
      );
      for (const paragraph of paragraphs(entry.description))
        add([paragraph], section.label, section.id);
      for (const bullet of entry.bullets.filter(
        (item) => !item.hidden && item.text,
      ))
        add([bullet.text], section.label, section.id);
      if (entry.technologies)
        add([entry.technologies], section.label, section.id);
      for (const link of entry.links.filter((item) => item.url))
        add([link.label || link.url], section.label, section.id);
    }
    for (const item of groups)
      add(
        [item.label, ...item.items.map((tag) => tag.text)],
        section.label,
        section.id,
      );
    if (languages.length)
      add(
        languages.flatMap((item) => [item.text, item.proficiency]),
        section.label,
        section.id,
      );
  }
  if (
    result.length > 1200 ||
    result.reduce((n, item) => n + item.text.length, 0) > 200000
  )
    throw new Error("Readability content exceeds bounds.");
  return result;
}
