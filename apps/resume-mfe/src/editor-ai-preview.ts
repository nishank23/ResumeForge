import type { SummaryDocument } from "@resume-forge/shared";
import {
  richTextPlain,
  sectionFor,
  targetValue,
  type DraftEntry,
  type DraftTarget,
  type MutationResult,
  type ResumeDraft,
} from "./editor-draft.ts";

export interface PreviewChange {
  label: string;
  original: string;
  proposed: string;
}
export interface LocalAiPreview {
  base: ResumeDraft;
  candidate: ResumeDraft;
  target: DraftTarget;
  changes: PreviewChange[];
}

// Temporary presentation examples, not an AI provider or a quality assessment.
// Only wording changes; never add a fact, metric, skill or qualification.
function previewWording(text: string): string {
  return text
    .replace(/\bin order to\b/g, "to")
    .replace(/\bwith (\d+) years of experience\b/g, "with $1 years’ experience")
    .replace(/\bLed migration of\b/g, "Led the migration of")
    .replace(
      /\bCreated deterministic (contract )?validator\b/g,
      "Created a deterministic $1validator",
    );
}

export function createLocalAiPreview(
  draft: ResumeDraft,
  target: DraftTarget,
): LocalAiPreview {
  const preview: LocalAiPreview = {
    base: structuredClone(draft),
    candidate: structuredClone(draft),
    target: structuredClone(target),
    changes: [],
  };
  const section = sectionFor(preview.candidate, target);
  const value = targetValue(preview.candidate, target);
  if (
    !section ||
    section.hidden ||
    !value ||
    value.hidden ||
    section.kind === "skills" ||
    section.kind === "languages" ||
    target.type === "header" ||
    target.type === "skill" ||
    target.type === "language"
  )
    return preview;

  const record = (label: string, original: string, proposed: string) => {
    if (original !== proposed)
      preview.changes.push({ label, original, proposed });
  };
  const rich = (label: string, doc: SummaryDocument) => {
    const original = richTextPlain(doc);
    const walk = (blocks: SummaryDocument["content"]) => {
      for (const block of blocks) {
        if (block.type === "paragraph") {
          for (const node of block.content ?? [])
            if (node.type === "text") node.text = previewWording(node.text);
        } else for (const item of block.content) walk(item.content);
      }
    };
    walk(doc.content);
    record(label, original, richTextPlain(doc));
  };
  const entry = (item: DraftEntry) => {
    if (item.hidden) return;
    rich(`${item.title || "Entry"} · Description`, item.description);
    item.bullets.forEach((bullet, index) => {
      if (bullet.hidden) return;
      const original = bullet.text;
      bullet.text = previewWording(original);
      record(
        `${item.title || "Entry"} · Achievement ${String(index + 1)}`,
        original,
        bullet.text,
      );
    });
  };
  if (target.type === "section" && "summary" in value) {
    if (section.kind === "summary") rich("Summary", value.summary);
    else value.entries.forEach(entry);
  } else if (target.type === "entry" && "description" in value) entry(value);
  else if (target.type === "bullet" && "text" in value) {
    const parent = section.entries.find((item) => item.id === target.entryId);
    if (!parent || parent.hidden) return preview;
    const original = value.text;
    value.text = previewWording(original);
    record("Achievement", original, value.text);
  }
  return preview;
}

export function acceptLocalAiPreview(
  current: ResumeDraft,
  preview: LocalAiPreview,
): MutationResult {
  if (JSON.stringify(current) !== JSON.stringify(preview.base))
    return {
      ok: false,
      error:
        "This draft changed. Close this preview and request changes again.",
    };
  if (!preview.changes.length)
    return { ok: false, error: "There are no suggested changes to accept." };
  return { ok: true, draft: structuredClone(preview.candidate) };
}
