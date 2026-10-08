import { z } from "zod";
// Private personal-workspace editor content; never an AI or sharing DTO.
export type RichInline =
  | { type: "text"; text: string; marks?: { type: "bold" | "italic" }[] }
  | { type: "hardBreak" };
export type RichParagraph = { type: "paragraph"; content?: RichInline[] };
export interface RichList {
  type: "bulletList";
  content: { type: "listItem"; content: (RichParagraph | RichList)[] }[];
}
export interface RichDocument {
  type: "doc";
  content: (RichParagraph | RichList)[];
}
const inline = z.union([
  z
    .object({
      type: z.literal("text"),
      text: z.string().max(20000),
      marks: z
        .array(z.object({ type: z.enum(["bold", "italic"]) }).strict())
        .max(2)
        .optional(),
    })
    .strict(),
  z.object({ type: z.literal("hardBreak") }).strict(),
]);
const paragraph = z
  .object({
    type: z.literal("paragraph"),
    content: z.array(inline).max(500).optional(),
  })
  .strict();
function blocks(depth: number): z.ZodType<RichParagraph | RichList> {
  if (!depth) return paragraph;
  return z.union([
    paragraph,
    z
      .object({
        type: z.literal("bulletList"),
        content: z
          .array(
            z
              .object({
                type: z.literal("listItem"),
                content: z.array(blocks(depth - 1)).max(100),
              })
              .strict(),
          )
          .max(100),
      })
      .strict(),
  ]);
}
export const richDocumentSchema: z.ZodType<RichDocument> = z
  .object({ type: z.literal("doc"), content: z.array(blocks(4)).max(200) })
  .strict();
const id = z.string().min(1).max(100);
const item = z
  .object({ id, text: z.string().max(2000), hidden: z.boolean() })
  .strict();
const link = z
  .object({
    id,
    label: z.string().max(100),
    url: z
      .string()
      .max(1000)
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        "Use an http or https link",
      ),
  })
  .strict();
const month = z.string().regex(/^(?:|[1-9]|1[0-2])$/);
const year = z.string().regex(/^(?:|\d{4})$/);
const dates = z
  .object({
    startMonth: month,
    startYear: year,
    endMonth: month,
    endYear: year,
    current: z.boolean(),
    yearOnly: z.boolean(),
  })
  .strict();
const typeStyle = (min: number, max: number) =>
  z
    .object({
      font: z.enum(["Georgia", "Times", "Arial"]),
      size: z.number().int().min(min).max(max),
      lineHeight: z.number().min(1.2).max(1.8),
      color: z.enum(["#222222", "#1f4e79", "#4338ca"]),
    })
    .strict();
const margin = z.number().int().min(20).max(64);
export const editorDocumentSchema = z
  .object({
    synthetic: z.boolean(),
    title: z.string().trim().min(1).max(200),
    header: z
      .object({
        firstName: z.string().max(100),
        lastName: z.string().max(100),
        headline: z.string().max(200),
        city: z.string().max(100),
        state: z.string().max(100),
        country: z.string().max(100),
        links: z.array(link).max(30).optional(),
      })
      .strict(),
    sampleContact: z
      .object({ email: z.string().max(200), phone: z.string().max(50) })
      .strict(),
    sections: z
      .array(
        z
          .object({
            id,
            kind: z.enum([
              "summary",
              "experience",
              "education",
              "projects",
              "skills",
              "languages",
            ]),
            label: z.string().max(100),
            hidden: z.boolean(),
            summary: richDocumentSchema,
            entries: z
              .array(
                z
                  .object({
                    id,
                    hidden: z.boolean(),
                    title: z.string().max(200),
                    subtitle: z.string().max(200),
                    location: z.string().max(200),
                    employmentType: z.string().max(100),
                    locationType: z.string().max(100),
                    fieldOfStudy: z.string().max(200),
                    grade: z.string().max(50),
                    dates,
                    description: richDocumentSchema,
                    bullets: z.array(item).max(100),
                    technologies: z.string().max(500),
                    links: z.array(link).max(30),
                  })
                  .strict(),
              )
              .max(100),
            groups: z
              .array(
                z
                  .object({
                    id,
                    label: z.string().max(100),
                    items: z.array(item).max(100),
                  })
                  .strict(),
              )
              .max(50),
            languages: z
              .array(item.extend({ proficiency: z.string().max(100) }))
              .max(100),
          })
          .strict(),
      )
      .max(30),
    appearance: z
      .object({
        sectionGap: z.number().int().min(12).max(28),
        itemGap: z.number().int().min(6).max(20),
        top: margin,
        right: margin,
        bottom: margin,
        left: margin,
        typography: z
          .object({
            section: typeStyle(14, 22),
            heading: typeStyle(12, 20),
            subheading: typeStyle(12, 18),
            body: typeStyle(12, 18),
          })
          .strict(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const ids: string[] = (doc.header.links ?? []).map((link) => link.id);
    for (const s of doc.sections) {
      ids.push(s.id);
      for (const e of s.entries)
        ids.push(
          e.id,
          ...e.bullets.map((b) => b.id),
          ...e.links.map((l) => l.id),
        );
      for (const g of s.groups) ids.push(g.id, ...g.items.map((i) => i.id));
      ids.push(...s.languages.map((l) => l.id));
    }
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Document item IDs must be unique",
      });
  });
export type EditorDocument = z.infer<typeof editorDocumentSchema>;
