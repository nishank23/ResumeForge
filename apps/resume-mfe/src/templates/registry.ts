import {
  DEFAULT_APPEARANCE,
  appearanceVariables,
  type EditorAppearance,
} from "../editor-appearance.ts";

export interface ResumeTemplate {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly appearance: EditorAppearance;
}

const modern = structuredClone(DEFAULT_APPEARANCE);
modern.sectionGap = 16;
modern.top = modern.bottom = 36;
modern.left = modern.right = 36;
for (const role of Object.values(modern.typography)) role.font = "Arial";
modern.typography.section.color = "#4338ca";
modern.typography.section.size = 15;
modern.typography.heading.size = 14;
modern.typography.body.lineHeight = 1.3;

const editorial = structuredClone(DEFAULT_APPEARANCE);
editorial.top = editorial.bottom = 40;
editorial.left = editorial.right = 44;
editorial.sectionGap = 18;
editorial.itemGap = 10;
for (const role of Object.values(editorial.typography)) role.font = "Times";
editorial.typography.section.font = "Georgia";
editorial.typography.section.size = 16;
editorial.typography.heading.size = 14;
editorial.typography.body.lineHeight = 1.35;

/** Original, versioned formatting templates. Every section uses the existing
 * single-column renderer. Persist exact settings, so PDFs/old versions never
 * depend on future registry defaults. No executable CSS or remote font assets.
 * Add an entry here and the picker discovers it automatically. */
export const RESUME_TEMPLATES: readonly ResumeTemplate[] = [
  {
    id: "forge-classic",
    version: 1,
    name: "Forge Classic",
    category: "Timeless",
    description: "Compact serif typography with a clear, traditional rhythm.",
    appearance: structuredClone(DEFAULT_APPEARANCE),
  },
  {
    id: "forge-modern",
    version: 1,
    name: "Forge Modern",
    category: "Contemporary",
    description:
      "Clean sans-serif text, indigo headings and comfortable spacing.",
    appearance: modern,
  },
  {
    id: "forge-editorial",
    version: 1,
    name: "Forge Editorial",
    category: "Editorial",
    description:
      "Refined Times text, Georgia headings and generous page margins.",
    appearance: editorial,
  },
];

export function templateAppearance(id: string): EditorAppearance | undefined {
  const template = RESUME_TEMPLATES.find((value) => value.id === id);
  return template ? structuredClone(template.appearance) : undefined;
}

export function matchingTemplate(appearance: EditorAppearance) {
  const current = JSON.stringify(appearanceVariables(appearance));
  return RESUME_TEMPLATES.find(
    (template) =>
      JSON.stringify(appearanceVariables(template.appearance)) === current,
  );
}
