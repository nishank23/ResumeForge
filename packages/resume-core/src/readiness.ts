/** Contact-free, visible professional facts; callers own authorization and projection. */
export interface ReadinessInput {
  sections: {
    id: string;
    kind: string;
    label: string;
    summary: string[];
    entries: {
      id: string;
      title: string;
      subtitle: string;
      details: string[];
      technologies?: string;
      bulletCount?: number;
      formatting?: { characters: number; boldCharacters: number };
      dates: {
        startYear: string;
        startMonth: string;
        endYear: string;
        endMonth: string;
        current: boolean;
        yearOnly: boolean;
      };
    }[];
    groups: { label: string; items: string[] }[];
  }[];
}
export type ReadinessTarget =
  | { type: "header" }
  | { type: "section"; sectionId: string }
  | { type: "entry"; sectionId: string; itemId: string };
export const READINESS_RUBRIC = "readiness-v2";
export const READINESS_COMPONENTS = [
  { id: "structure", label: "Structure", weight: 25 },
  { id: "detail", label: "Experience detail", weight: 25 },
  { id: "skills", label: "Skills presentation", weight: 20 },
  { id: "clarity", label: "Achievement clarity", weight: 15 },
  { id: "dates", label: "Date consistency", weight: 15 },
] as const;
export type ReadinessComponentId = (typeof READINESS_COMPONENTS)[number]["id"];
export interface ReadinessCheck {
  id: string;
  componentId: ReadinessComponentId;
  title: string;
  reason: string;
  passed: boolean;
  target: ReadinessTarget | null;
  /** false marks actionable advice that never changes component scores. */
  scored?: false;
}
export type ReadinessResult = ReturnType<typeof computeReadiness>;
export interface ReadinessHints { contactComplete: boolean }
export function computeReadiness(input: ReadinessInput, hints?: ReadinessHints) {
  let checkTotal = 0;
  const checks: ReadinessCheck[] = [];
  const counts = new Map<
    ReadinessComponentId,
    { total: number; passed: number }
  >();
  const add = (
    componentId: ReadinessComponentId,
    rule: string,
    title: string,
    reason: string,
    passed: boolean,
    target: ReadinessTarget | null,
    scored = true,
  ) => {
    checkTotal++;
    const count = counts.get(componentId) ?? { total: 0, passed: 0 };
    if (scored) {
      count.total++;
      if (passed) count.passed++;
      counts.set(componentId, count);
    }
    if (checks.length < 100)
      checks.push({
        id:
          componentId === "structure" || componentId === "skills"
            ? rule
            : `${rule}:${JSON.stringify(target)}`,
        componentId,
        title,
        reason,
        passed,
        target,
        ...(scored ? {} : { scored: false as const }),
      });
  };
  const words = (text: string) => text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  const populated = input.sections.filter(
    (s) =>
      s.summary.some((t) => t.trim()) ||
      s.entries.some(
        (e) =>
          e.title.trim() ||
          e.subtitle.trim() ||
          e.details.some((t) => t.trim()),
      ) ||
      s.groups.some((g) => g.items.length),
  );
  const professional = input.sections.filter((s) =>
    ["experience", "projects"].includes(s.kind),
  );
  const entries = professional.flatMap((s) => s.entries.map((e) => ({ s, e })));
  const skills = input.sections.find((s) => s.kind === "skills");
  const skillItems =
    skills?.groups.flatMap((g) => g.items).filter((t) => t.trim()) ?? [];
  const sectionTarget = (id?: string): ReadinessTarget | null =>
    id ? { type: "section", sectionId: id } : null;
  add(
    "structure",
    "professional-section",
    "Show experience, projects or education",
    "A visible professional entry or education entry supplies background; paid experience is not required.",
    populated.some(
      (s) =>
        ["experience", "projects", "education"].includes(s.kind) &&
        s.entries.some(
          (e) =>
            e.title.trim() ||
            e.subtitle.trim() ||
            e.details.some((t) => t.trim()),
        ),
    ),
    sectionTarget(professional[0]?.id),
  );
  add(
    "structure",
    "skills-section",
    "Include visible skills",
    "At least one visible skills item must be present.",
    skillItems.length > 0,
    sectionTarget(skills?.id),
  );
  add(
    "structure",
    "section-headings",
    "Use clear section headings",
    "Populated sections need non-empty, distinct headings. Empty template headings earn no credit.",
    populated.length > 0 &&
      populated.every((s) => s.label.trim()) &&
      new Set(populated.map((s) => s.label.trim().toLowerCase())).size ===
        populated.length,
    sectionTarget(populated.find((s) => !s.label.trim())?.id),
  );
  add(
    "structure",
    "organized-content",
    "Organize professional content",
    "At least two populated sections provide organization. A summary is optional.",
    populated.length >= 2,
    null,
  );
  if (!entries.length)
    add(
      "detail",
      "entry-details",
      "Describe experience or projects",
      "Add a relevant project or experience entry; employment is not required.",
      false,
      sectionTarget(professional[0]?.id),
    );
  for (const { s, e } of entries) {
    const target: ReadinessTarget = {
      type: "entry",
      sectionId: s.id,
      itemId: e.id,
    };
    add(
      "detail",
      "entry-title",
      "Name this role or project",
      "A visible entry title identifies the work.",
      !!e.title.trim(),
      target,
    );
    add(
      "detail",
      "entry-context",
      "Give this work context",
      "An employer, client, team or project context belongs in the subtitle.",
      !!e.subtitle.trim(),
      target,
    );
    add(
      "detail",
      "entry-description",
      "Describe what you did",
      "At least one visible description or achievement should contain eight words. Length checks do not verify truth.",
      e.details.some((t) => words(t) >= 8),
      target,
    );
  }
  const skillsTarget = sectionTarget(skills?.id);
  add(
    "skills",
    "listed-skills",
    "List your supported skills",
    "At least one visible skills item is required. More keywords do not raise this check.",
    skillItems.length > 0,
    skillsTarget,
  );
  add(
    "skills",
    "skill-categories",
    "Label populated skill categories",
    "Every populated skills group needs a label.",
    !!skills &&
      skills.groups.some((g) => g.items.length) &&
      skills.groups.filter((g) => g.items.length).every((g) => g.label.trim()),
    skillsTarget,
  );
  add(
    "skills",
    "distinct-skills",
    "Remove duplicate skill items",
    "Visible skill items should be distinct after case and whitespace normalization.",
    skillItems.length > 0 &&
      new Set(
        skillItems.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ")),
      ).size === skillItems.length,
    skillsTarget,
  );
  add(
    "skills",
    "concise-skills",
    "Keep skill items concise",
    "Use individual items of at most eight words and 80 characters; this does not measure job relevance.",
    skillItems.length > 0 &&
      skillItems.every((t) => words(t) <= 8 && t.length <= 80),
    skillsTarget,
  );
  if (!entries.length)
    add(
      "clarity",
      "readable-statements",
      "Describe a supported contribution",
      "Add a visible description or achievement. Metrics are optional; never invent one to raise this score.",
      false,
      null,
    );
  for (const { s, e } of entries) {
    const statements = e.details.filter((t) => t.trim());
    add(
      "clarity",
      "readable-statements",
      "Keep this entry's achievements readable",
      "Every visible description or achievement uses 8–60 words in this rubric. No grammar, outcome or numerical impact is inferred; metrics are optional.",
      statements.length > 0 &&
        statements.every((t) => words(t) >= 8 && words(t) <= 60),
      { type: "entry", sectionId: s.id, itemId: e.id },
    );
  }
  let datedEntries = 0;
  for (const s of input.sections.filter((s) =>
    ["experience", "education", "projects"].includes(s.kind),
  ))
    for (const e of s.entries) {
      const d = e.dates;
      if (s.kind === "projects" && !d.startYear && !d.endYear && !d.current)
        continue;
      datedEntries++;
      const target: ReadinessTarget = {
        type: "entry",
        sectionId: s.id,
        itemId: e.id,
      };
      const complete =
        !!d.startYear &&
        (d.current || !!d.endYear) &&
        (d.yearOnly || (!!d.startMonth && (d.current || !!d.endMonth)));
      const start = Number(d.startYear) * 12 + Number(d.startMonth || 1);
      const end = Number(d.endYear) * 12 + Number(d.endMonth || 12);
      add(
        "dates",
        "complete-dates",
        "Complete this date range",
        "Use a start date and an end date or Present. Year-only ranges are supported; undated projects are optional.",
        complete,
        target,
      );
      add(
        "dates",
        "ordered-dates",
        "Keep dates in chronological order",
        "The end must not precede the start. This check does not infer gaps or employment tenure.",
        complete && (d.current || end >= start),
        target,
      );
      add(
        "dates",
        "current-end",
        "Use Present consistently",
        "A current entry should not also contain an end date.",
        complete && (!d.current || (!d.endYear && !d.endMonth)),
        target,
      );
    }
  if (!datedEntries)
    add(
      "dates",
      "date-evidence",
      "Include a dated background entry",
      "No visible experience, education or dated project can be checked.",
      false,
      null,
    );
  // Practical editing guidance augments the original rubric without changing
  // its approved weights or encouraging invented facts to gain score points.
  for (const { s, e } of entries) {
    const target: ReadinessTarget = { type: "entry", sectionId: s.id, itemId: e.id };
    const bullets = e.bulletCount ?? e.details.filter((t) => t.trim()).length;
    add("clarity", "bullet-volume", "Balance bullet point volume",
      `This entry has ${String(bullets)} visible bullets. Aim for 2–6 supported contributions; combine repeated points or add real details only. A paragraph can remain a paragraph. This advice does not change the score.`,
      bullets >= 2 && bullets <= 6, target, false);
    add("detail", "entry-technologies", "Show technologies and tools used",
      "List the tools supported by this specific role or project in Technologies. Tools may already appear in its description; never add an unsupported skill. This advice does not change the score.",
      !!e.technologies?.trim(), target, false);
    const f = e.formatting;
    add("clarity", "bold-formatting", "Keep bold formatting selective",
      "For descriptions of at least 120 characters, emphasize no more than half the text. This checks editor rich text; imported PDF font emphasis is not retained. This advice does not change the score.",
      !f || f.characters < 120 || f.boldCharacters <= f.characters / 2, target, false);
  }
  add("skills", "skill-count", "Include a useful range of skills",
    `There are ${String(new Set(skillItems.map((t) => t.trim().toLowerCase())).size)} distinct visible skills. Aim for at least five if supported by your background. Never invent skills; this advice does not change the score.`,
    new Set(skillItems.map((t) => t.trim().toLowerCase())).size >= 5, skillsTarget, false);
  const education = input.sections.find((s) => s.kind === "education");
  if (!education?.entries.length) add("detail", "education-details", "Review education details",
    "If applicable, add your institute, degree and dates. Education is optional for this rubric; this advice does not change the score.", false, sectionTarget(education?.id), false);
  if (education) for (const e of education.entries) add("detail", "education-details", "Review education details",
    "Include the institute, degree and a start/end date or Present for this visible education entry. This advice does not change the score.",
    !!e.title.trim() && !!e.subtitle.trim() && !!e.dates.startYear && (!!e.dates.endYear || e.dates.current),
    { type: "entry", sectionId: education.id, itemId: e.id }, false);
  if (hints) add("structure", "contact-presence", "Check essential contact details",
    "Add a name, email, phone and location you want on this private resume. Only presence is checked; contact values are excluded from scoring and AI. This advice does not change the score.",
    hints.contactComplete, { type: "header" }, false);
  const components = READINESS_COMPONENTS.map((c) => {
    const count = counts.get(c.id) ?? { total: 0, passed: 0 };
    return {
      ...c,
      score: count.total ? Math.round((count.passed / count.total) * 100) : 0,
      passed: count.passed,
      total: count.total,
    };
  });
  return {
    mode: "general" as const,
    rubricVersion: READINESS_RUBRIC,
    score: Math.round(
      components.reduce((n, c) => n + (c.score * c.weight) / 100, 0),
    ),
    components,
    checks,
    truncated:
      checkTotal > checks.length,
  };
}
