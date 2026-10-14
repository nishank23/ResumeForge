import { z } from "zod";
import {
  editorDocumentSchema,
  type EditorDocument,
  type RichDocument,
  type RichParagraph,
  type RichList,
  type RichInline,
} from "./editor-document.js";
import { rewriteRequestSchema } from "./ats-workflow.js";
const rewriteTargetSchema = rewriteRequestSchema.shape.target;

const id = z.string().min(1).max(100);
const common = {
  id,
  label: z.string().max(400),
  original: z.string().max(20000),
  proposed: z.string().max(20000),
  facts: z.array(id).max(200),
  evidence: z.array(z.string().max(20000)).max(200).default([]),
};
export const tailoringChangeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...common,
      kind: z.literal("text"),
      target: rewriteTargetSchema,
      field: id,
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal("order"),
      scope: z.enum(["projects", "bullets", "skills", "sections"]),
      sectionId: id,
      parentId: id.nullable(),
      originalIds: z.array(id).max(100),
      proposedIds: z.array(id).max(100),
    })
    .strict(),
]);
export type TailoringChange = z.infer<typeof tailoringChangeSchema>;
export const tailoringAnalysisSchema = z
  .object({
    score: z.number().min(0).max(100).nullable(),
    matched: z.array(z.string().max(200)).max(100),
    missing: z.array(z.string().max(200)).max(100),
    statedYears: z.number().min(0).max(60).nullable(),
    datedYears: z.number().min(0).max(100).nullable(),
    experienceLevel: z.string().max(100),
  })
  .strict();
export const tailoringRunSchema = z
  .object({
    id: z.string().uuid(),
    sourceVersion: z.number().int().positive(),
    model: z.string().max(100).default("gemini-3.5-flash-lite"),
    promptVersion: z.enum(["tailor-v1", "tailor-v2"]).default("tailor-v1"),
    quality: z
      .object({
        sourceWords: z.number().int().min(0),
        proposedWords: z.number().int().min(0),
        fieldsChecked: z.number().int().min(0),
        fieldsRewritten: z.number().int().min(0),
        retainedOriginal: z.number().int().min(0),
      })
      .strict()
      .nullable()
      .default(null),
    warnings: z.array(z.string().max(400)).max(10).default([]),
    status: z.enum([
      "queued",
      "drafting",
      "ready",
      "failed",
      "cancelled",
      "saved",
    ]),
    jobTitle: z.string().max(200),
    jdText: z.string().min(50).max(12000),
    requirements: z
      .array(
        z
          .object({
            name: z.string().max(200),
            category: z.string().max(100),
            required: z.boolean(),
            evidence: z.string().max(300),
          })
          .strict(),
      )
      .max(100),
    responsibilities: z.array(z.string().max(2000)).max(30),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    batchesDone: z.number().int().min(0),
    batchesTotal: z.number().int().min(1).max(20),
    before: tailoringAnalysisSchema,
    after: tailoringAnalysisSchema.nullable(),
    changes: z.array(tailoringChangeSchema).max(400),
    copyId: z.string().uuid().nullable(),
    error: z.string().max(400).nullable(),
  })
  .strict();
export type TailoringRun = z.infer<typeof tailoringRunSchema>;
export const tailoringStateSchema = z
  .object({
    currentVersion: z.number().int().positive(),
    available: z.boolean(),
    run: tailoringRunSchema.nullable(),
  })
  .strict();
export type TailoringState = z.infer<typeof tailoringStateSchema>;
export const tailoringStartSchema = z
  .object({
    id: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    jdText: z.string().trim().min(50).max(12000),
    consent: z.literal(true),
  })
  .strict();
export const tailoringCancelSchema = z
  .object({ runId: z.string().uuid() })
  .strict();
export const tailoringApplySchema = z
  .object({
    runId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    selectedIds: z.array(id).max(400),
    title: z.string().trim().min(1).max(200),
  })
  .strict();

/** Typed preview operations; server grounding/version checks remain mandatory. */
export function applyTailoringPreview(
  source: EditorDocument,
  changes: TailoringChange[],
  selectedIds: string[],
) {
  const next = editorDocumentSchema.parse(source),
    selected = new Set(selectedIds);
  if (
    selected.size !== selectedIds.length ||
    selectedIds.some((id) => !changes.some((c) => c.id === id))
  )
    throw new Error("Invalid change selection");
  const rich = (text: string): RichDocument => ({
    type: "doc" as const,
    content: text.split("\n").map((value) => ({
      type: "paragraph" as const,
      content: value ? [{ type: "text" as const, text: value }] : [],
    })),
  });
  const richDescription = (
    text: string,
    original: RichDocument,
  ): RichDocument => {
    const lines = text.split("\n");
    const paragraphs: RichParagraph[] = [];
    const collect = (blocks: (RichParagraph | RichList)[]) => {
      for (const b of blocks) {
        if (b.type === "paragraph") paragraphs.push(b);
        else for (const item of b.content) collect(item.content);
      }
    };
    collect(original.content);
    const count = paragraphs.reduce(
      (n, p) =>
        n + 1 + (p.content?.filter((i) => i.type === "hardBreak").length ?? 0),
      0,
    );
    if (count !== lines.length) return rich(text);
    let position = 0;
    for (const p of paragraphs) {
      const size =
        1 + (p.content?.filter((i) => i.type === "hardBreak").length ?? 0);
      const content: RichInline[] = [];
      for (let i = 0; i < size; i++) {
        if (i) content.push({ type: "hardBreak" });
        const value = lines[position++]!;
        if (value) content.push({ type: "text", text: value });
      }
      p.content = content;
    }
    return original;
  };
  for (const c of changes.filter((c) => selected.has(c.id))) {
    if (c.kind === "order" && c.scope === "sections") {
      const visible = next.sections.filter((s) => !s.hidden);
      if (
        c.sectionId !== "document" ||
        c.parentId !== null ||
        JSON.stringify(visible.map((s) => s.id)) !==
          JSON.stringify(c.originalIds) ||
        new Set(c.proposedIds).size !== visible.length ||
        c.proposedIds.some((id) => !visible.some((s) => s.id === id))
      )
        throw new Error("Invalid section order");
      const ordered = c.proposedIds.map((id) =>
        visible.find((s) => s.id === id)!,
      );
      let position = 0;
      next.sections = next.sections.map((s) =>
        s.hidden ? s : ordered[position++]!,
      );
      continue;
    }
    const sectionId = c.kind === "text" ? c.target.sectionId : c.sectionId;
    const s = next.sections.find((s) => s.id === sectionId && !s.hidden);
    if (!s) throw new Error("Change target unavailable");
    if (c.kind === "text") {
      if (
        c.target.type === "section" &&
        s.kind === "summary" &&
        c.field === "summary"
      )
        s.summary = rich(c.proposed);
      else if (
        c.target.type === "entry" &&
        ["experience", "projects"].includes(s.kind)
      ) {
        const e = s.entries.find(
          (e) =>
            e.id === (c.target.type === "entry" ? c.target.itemId : "") &&
            !e.hidden,
        );
        if (!e) throw new Error("Change target unavailable");
        if (c.field === "description")
          e.description = richDescription(c.proposed, e.description);
        else {
          const b = e.bullets.find(
            (b) => `bullet:${b.id}` === c.field && !b.hidden,
          );
          if (!b) throw new Error("Change target unavailable");
          b.text = c.proposed;
        }
      } else throw new Error("Unsupported change target");
    } else {
      const list =
        c.scope === "projects" && s.kind === "projects"
          ? s.entries
          : c.scope === "bullets"
            ? s.entries.find((e) => e.id === c.parentId && !e.hidden)?.bullets
            : c.scope === "skills" && s.kind === "skills"
              ? s.groups.find((g) => g.id === c.parentId)?.items
              : undefined;
      if (!list) throw new Error("Change target unavailable");
      const visible = list.filter((item) => !item.hidden);
      if (
        JSON.stringify(visible.map((v) => v.id)) !==
          JSON.stringify(c.originalIds) ||
        new Set(c.proposedIds).size !== visible.length ||
        c.proposedIds.some((id) => !visible.some((v) => v.id === id))
      )
        throw new Error("Invalid change order");
      const ordered = c.proposedIds.map((id) =>
        visible.find((v) => v.id === id)!,
      );
      let position = 0;
      // Hidden items keep their existing positions and content.
      const sorted = list.map((item) =>
        item.hidden ? item : ordered[position++]!,
      );
      if (c.scope === "projects") s.entries = sorted as typeof s.entries;
      else if (c.scope === "bullets")
        s.entries.find((e) => e.id === c.parentId)!.bullets =
          sorted as (typeof s.entries)[number]["bullets"];
      else
        s.groups.find((g) => g.id === c.parentId)!.items =
          sorted as (typeof s.groups)[number]["items"];
    }
  }
  return editorDocumentSchema.parse(next);
}
