import { createElement as h, type ReactNode } from "react";
import {
  Document,
  Page,
  View,
  Text,
  Link,
  Font,
  renderToBuffer,
  type Styles,
} from "@react-pdf/renderer";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import {
  editorDocumentSchema,
  type EditorDocument,
  type RichDocument,
} from "@resume-forge/shared-types";

type RichList = Extract<
  RichDocument["content"][number],
  { type: "bulletList" }
>;
type RichParagraph = Extract<
  RichDocument["content"][number],
  { type: "paragraph" }
>;
const require = createRequire(import.meta.url);
const families = ["Georgia", "Times", "Arial"] as const;
// Local system fonts match the editor. Portable deployments use bundled,
// licensed Noto fonts; they never fetch fonts or user links over the network.
for (const family of families) {
  const name = family === "Times" ? "Times New Roman" : family;
  const system = `/System/Library/Fonts/Supplemental/${name}.ttf`;
  const fallback = family === "Arial" ? "noto-sans" : "noto-serif";
  Font.register({
    family,
    fonts: [
      [400, "normal", ""],
      [700, "normal", " Bold"],
      [400, "italic", " Italic"],
      [700, "italic", " Bold Italic"],
    ].map(([weight, style, suffix]) => ({
      src: existsSync(system)
        ? `/System/Library/Fonts/Supplemental/${name}${String(suffix)}.ttf`
        : require.resolve(
            `@fontsource/${fallback}/files/${fallback}-latin-${String(weight)}-${String(style)}.woff`,
          ),
      fontWeight: Number(weight),
      fontStyle: style as "normal" | "italic",
    })),
  });
}
Font.registerHyphenationCallback((word) => [word]);
const px = (value: number) => value * 0.75;
const defaults: NonNullable<EditorDocument["appearance"]> = {
  top: 28,
  right: 28,
  bottom: 28,
  left: 28,
  sectionGap: 12,
  itemGap: 6,
  typography: {
    section: { font: "Georgia", size: 14, lineHeight: 1.2, color: "#222222" },
    heading: { font: "Georgia", size: 13, lineHeight: 1.2, color: "#222222" },
    subheading: {
      font: "Georgia",
      size: 13,
      lineHeight: 1.2,
      color: "#222222",
    },
    body: { font: "Georgia", size: 13, lineHeight: 1.2, color: "#222222" },
  },
};
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
function plain(v: RichDocument | RichParagraph | RichList): string {
  return "content" in v
    ? (v.content ?? [])
        .map((node) =>
          "text" in node ? node.text : plain(node as RichParagraph),
        )
        .join(" ")
    : "";
}

function isGlyphFont(
  value: unknown,
): value is { hasGlyphForCodePoint: (point: number) => boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    "hasGlyphForCodePoint" in value &&
    typeof value.hasGlyphForCodePoint === "function"
  );
}

/** Pure, contact-bearing OWNER template; not a shared or AI render DTO. */
export async function renderResumePdf(input: unknown): Promise<Buffer> {
  const draft = editorDocumentSchema.parse(input);
  const a = draft.appearance ?? defaults;
  const roles: Styles = Object.fromEntries(
    Object.entries(a.typography).map(([role, s]) => [
      role,
      {
        fontFamily: s.font,
        fontSize: px(s.size),
        lineHeight: s.lineHeight,
        color: s.color,
      },
    ]),
  );
  const emitted: {
    text: string;
    font: string;
    weight: number;
    italic: boolean;
  }[] = [];
  function text(value: string, style: Styles[string] = {}, key?: string) {
    const merged = { ...roles.body, ...style };
    emitted.push({
      text: value,
      font: String(merged.fontFamily),
      weight: Number(merged.fontWeight ?? 400),
      italic: merged.fontStyle === "italic",
    });
    return h(Text, { style, key }, value);
  }
  function rich(blocks: RichDocument["content"], depth = 0): ReactNode[] {
    return blocks
      .filter((block) => plain(block).trim())
      .map((block, i) =>
        block.type === "bulletList"
          ? h(
              View,
              { key: i },
              ...block.content.map((item, j) =>
                h(
                  View,
                  {
                    key: j,
                    style: {
                      flexDirection: "row",
                      paddingLeft: px(12 * depth),
                    },
                  },
                  text("•", { width: px(12) }),
                  h(
                    View,
                    { style: { flexGrow: 1, flexShrink: 1 } },
                    ...rich(item.content, depth + 1),
                  ),
                ),
              ),
            )
          : h(
              Text,
              { key: i, minPresenceAhead: px(24) },
              ...(block.content ?? []).map((node, j) =>
                node.type === "hardBreak"
                  ? text("\n", {}, String(j))
                  : text(
                      node.text,
                      {
                        fontWeight: node.marks?.some((m) => m.type === "bold")
                          ? 700
                          : 400,
                        fontStyle: node.marks?.some((m) => m.type === "italic")
                          ? "italic"
                          : "normal",
                      },
                      String(j),
                    ),
              ),
            ),
      );
  }
  function link(l: { label: string; url: string; id: string }) {
    // Schema restricts schemes; Link creates an annotation, never a network request.
    emitted.push({
      text: l.label || l.url,
      font: a.typography.body.font,
      weight: 400,
      italic: false,
    });
    return h(
      Link,
      {
        key: l.id,
        src: l.url,
        style: { color: a.typography.body.color, textDecoration: "none" },
      },
      l.label || l.url,
    );
  }
  const name = [draft.header.firstName, draft.header.lastName]
    .filter(Boolean)
    .join(" ");
  const location = [draft.header.city, draft.header.state, draft.header.country]
    .filter(Boolean)
    .join(", ");
  const header = h(
    View,
    { style: { marginBottom: px(12), textAlign: "center" } },
    name ? text(name, { fontSize: px(28), lineHeight: 1.2 }) : null,
    draft.header.headline
      ? text(draft.header.headline, {
          fontSize: px(13),
          lineHeight: 1.2,
          fontStyle: "italic",
        })
      : null,
    h(
      Text,
      { style: { fontSize: px(11), lineHeight: 1.2, marginTop: px(6) } },
      text(
        [draft.sampleContact.phone, draft.sampleContact.email, location]
          .filter(Boolean)
          .join("  |  "),
        { fontSize: px(11) },
      ),
      ...(draft.header.links ?? [])
        .filter((l) => l.url)
        .flatMap((l) => [
          text("  |  ", { fontSize: px(11) }, `${l.id}-separator`),
          link(l),
        ]),
    ),
  );
  const sections = draft.sections
    .filter((s) => !s.hidden)
    .map((s) => {
      const entries = s.entries.filter(
        (e) =>
          !e.hidden &&
          (e.title ||
            e.subtitle ||
            e.employmentType ||
            e.fieldOfStudy ||
            e.location ||
            e.grade ||
            plain(e.description).trim() ||
            e.technologies ||
            e.links.some((l) => l.url) ||
            e.bullets.some((b) => !b.hidden && b.text)),
      );
      const groups = s.groups
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => !item.hidden && item.text),
        }))
        .filter((g) => g.items.length);
      const languages = s.languages.filter((l) => !l.hidden && l.text);
      if (
        !plain(s.summary).trim() &&
        !entries.length &&
        !groups.length &&
        !languages.length
      )
        return null;
      return h(
        View,
        { key: s.id, style: { marginBottom: px(a.sectionGap) } },
        text(
          s.label.toLocaleUpperCase(),
          {
            ...roles.section,
            fontWeight: 700,
            borderBottomWidth: 0.6,
            borderBottomColor: "#222222",
            marginBottom: px(6),
          },
          `${s.id}-heading`,
        ),
        ...rich(s.summary.content),
        ...entries.map((e) =>
          h(
            View,
            { key: e.id, style: { marginBottom: px(a.itemGap) } },
            h(
              View,
              {
                wrap: false,
                minPresenceAhead: px(20),
                style: {
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: px(2),
                },
              },
              h(
                Text,
                {
                  style: {
                    ...roles.heading,
                    flexGrow: 1,
                    flexShrink: 1,
                    paddingRight: px(12),
                  },
                },
                text(e.title, { ...roles.heading, fontWeight: 700 }),
                text(
                  [e.employmentType, e.fieldOfStudy]
                    .filter(Boolean)
                    .map((v) => ` | ${v}`)
                    .join(""),
                  roles.heading,
                ),
              ),
              dates(e.dates)
                ? text(dates(e.dates), {
                    ...roles.body,
                    textAlign: "right",
                    maxWidth: "32%",
                  })
                : null,
            ),
            e.subtitle || e.location || e.locationType
              ? h(
                  View,
                  {
                    style: {
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: px(2),
                    },
                  },
                  text(e.subtitle, {
                    ...roles.subheading,
                    fontStyle: "italic",
                    flexGrow: 1,
                    flexShrink: 1,
                    paddingRight: px(12),
                  }),
                  text(
                    [e.locationType, e.location].filter(Boolean).join(" · "),
                    {
                      ...roles.subheading,
                      fontStyle: "italic",
                      textAlign: "right",
                      maxWidth: "42%",
                    },
                  ),
                )
              : null,
            e.grade ? text(e.grade) : null,
            ...rich(e.description.content),
            ...e.bullets
              .filter((b) => !b.hidden && b.text)
              .map((b) =>
                h(
                  View,
                  { key: b.id, style: { flexDirection: "row" } },
                  text("•", { width: px(12) }),
                  text(b.text, { flexGrow: 1, flexShrink: 1 }),
                ),
              ),
            e.technologies
              ? h(
                  Text,
                  { style: { fontStyle: "italic" } },
                  text("Technologies / tools used: ", {
                    fontWeight: 700,
                    fontStyle: "italic",
                  }),
                  text(e.technologies, { fontStyle: "italic" }),
                )
              : null,
            ...e.links.filter((l) => l.url).map(link),
          ),
        ),
        ...groups.map((g) =>
          h(
            View,
            { key: g.id, style: { flexDirection: "row" } },
            text(`${g.label}:`, { width: px(180), fontWeight: 700 }),
            text(g.items.map((i) => i.text).join(", "), {
              flexGrow: 1,
              flexShrink: 1,
            }),
          ),
        ),
        languages.length
          ? h(
              View,
              { style: { flexDirection: "row" } },
              text("Languages:", { width: px(180), fontWeight: 700 }),
              text(
                languages
                  .map((l) =>
                    [l.text, l.proficiency].filter(Boolean).join(" - "),
                  )
                  .join(", "),
                { flexGrow: 1, flexShrink: 1 },
              ),
            )
          : null,
      );
    });
  if (emitted.reduce((length, run) => length + run.text.length, 0) > 200_000)
    throw new Error("pdf_too_large");
  // Fail visibly for unsupported glyphs instead of silently dropping qualifications.
  for (const run of emitted) {
    const source = Font.getFont({
      fontFamily: run.font,
      fontWeight: run.weight,
      fontStyle: run.italic ? "italic" : "normal",
    });
    await source.load();
    const font: unknown = source.data;
    if (!isGlyphFont(font)) throw new Error("pdf_unsupported_characters");
    for (const character of run.text.replace(/\s/g, "")) {
      const point = character.codePointAt(0);
      if (point === undefined || !font.hasGlyphForCodePoint(point))
        throw new Error("pdf_unsupported_characters");
    }
  }
  const buffer = await renderToBuffer(
    h(
      Document,
      { title: "Resume", author: "", creator: "resume-forge" },
      h(
        Page,
        {
          size: "A4",
          style: {
            ...roles.body,
            paddingTop: px(a.top),
            paddingRight: px(a.right),
            paddingBottom: px(a.bottom),
            paddingLeft: px(a.left),
          },
        },
        header,
        ...sections,
      ),
    ),
  );
  if (buffer.length > 15 * 1024 * 1024) throw new Error("pdf_too_large");
  return buffer;
}
