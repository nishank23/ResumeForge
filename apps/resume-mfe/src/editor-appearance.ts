import type { ResumeDraft, MutationResult } from "./editor-draft";

// Bounded private editor appearance; PDF rendering remains disconnected.
export const PAPER_FONTS = {
  Georgia: 'Georgia, "Times New Roman", serif',
  Times: '"Times New Roman", Times, serif',
  Arial: "Arial, Helvetica, sans-serif",
} as const;
export const PAPER_COLORS = ["#222222", "#1f4e79", "#4338ca"] as const;
export const TYPE_ROLES = {
  section: "Section headers",
  heading: "Entry headings",
  subheading: "Subheadings",
  body: "Description & skills",
} as const;
export type TypeRole = keyof typeof TYPE_ROLES;
export interface PaperType {
  font: keyof typeof PAPER_FONTS;
  size: number;
  lineHeight: number;
  color: (typeof PAPER_COLORS)[number];
}
export interface EditorAppearance {
  sectionGap: number;
  itemGap: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  typography: Record<TypeRole, PaperType>;
}
export const DEFAULT_APPEARANCE: EditorAppearance = {
  sectionGap: 12,
  itemGap: 6,
  top: 28,
  right: 28,
  bottom: 28,
  left: 28,
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
export const APPEARANCE_BOUNDS = {
  sectionGap: [12, 28],
  itemGap: [6, 20],
  top: [20, 64],
  right: [20, 64],
  bottom: [20, 64],
  left: [20, 64],
} as const;
export const TYPE_SIZE_BOUNDS: Record<TypeRole, readonly [number, number]> = {
  section: [14, 22],
  heading: [12, 20],
  subheading: [12, 18],
  body: [12, 18],
};
export function appearancePreset(
  name: "compact" | "balanced" | "spacious",
): EditorAppearance {
  const next = structuredClone(DEFAULT_APPEARANCE);
  if (name === "balanced") {
    next.sectionGap = 18;
    next.itemGap = 12;
    next.typography.body.lineHeight = 1.4;
  }
  if (name === "compact") {
    next.sectionGap = 12;
    next.itemGap = 6;
    next.top = next.right = next.bottom = next.left = 28;
    next.typography.body.size = 13;
  }
  if (name === "spacious") {
    next.sectionGap = 24;
    next.itemGap = 16;
    next.typography.body.size = 15;
    next.typography.body.lineHeight = 1.6;
  }
  return next;
}
export function updateAppearance(
  draft: ResumeDraft,
  appearance: EditorAppearance,
): MutationResult {
  for (const key of Object.keys(
    APPEARANCE_BOUNDS,
  ) as (keyof typeof APPEARANCE_BOUNDS)[]) {
    const value = appearance[key],
      [min, max] = APPEARANCE_BOUNDS[key];
    if (!Number.isInteger(value) || value < min || value > max)
      return { ok: false, error: "Use the allowed spacing and margin range." };
  }
  for (const role of Object.keys(TYPE_ROLES) as TypeRole[]) {
    const value = appearance.typography[role],
      [min, max] = TYPE_SIZE_BOUNDS[role];
    if (
      !Object.hasOwn(PAPER_FONTS, value.font) ||
      !PAPER_COLORS.includes(value.color) ||
      !Number.isInteger(value.size) ||
      value.size < min ||
      value.size > max ||
      !Number.isFinite(value.lineHeight) ||
      value.lineHeight < 1.2 ||
      value.lineHeight > 1.8
    )
      return {
        ok: false,
        error: "Use a supported font, color and readable text size.",
      };
  }
  // Project only the allowed settings; arbitrary CSS/URLs/extra fields are not retained.
  const next = structuredClone(draft);
  next.appearance = {
    sectionGap: appearance.sectionGap,
    itemGap: appearance.itemGap,
    top: appearance.top,
    right: appearance.right,
    bottom: appearance.bottom,
    left: appearance.left,
    typography: Object.fromEntries(
      (Object.keys(TYPE_ROLES) as TypeRole[]).map((role) => {
        const { font, size, lineHeight, color } = appearance.typography[role];
        return [role, { font, size, lineHeight, color }];
      }),
    ) as Record<TypeRole, PaperType>,
  };
  return { ok: true, draft: next };
}
export function appearanceVariables(
  appearance: EditorAppearance,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of Object.keys(
    APPEARANCE_BOUNDS,
  ) as (keyof typeof APPEARANCE_BOUNDS)[])
    vars[`--paper-${key}`] = `${String(appearance[key])}px`;
  for (const role of Object.keys(TYPE_ROLES) as TypeRole[]) {
    const value = appearance.typography[role];
    vars[`--paper-${role}-font`] = PAPER_FONTS[value.font];
    vars[`--paper-${role}-size`] = `${String(value.size)}px`;
    vars[`--paper-${role}-line`] = String(value.lineHeight);
    vars[`--paper-${role}-color`] = value.color;
  }
  return vars;
}
