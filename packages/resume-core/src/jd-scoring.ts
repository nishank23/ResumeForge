import {
  computeReadiness,
  type ReadinessInput,
  type ReadinessCheck,
  type ReadinessTarget,
} from "./readiness.js";
export interface JdRequirements {
  terms: { name: string; required: boolean; skill: boolean }[];
  responsibilities: string[];
}
export interface JdTechnologyEvidence {
  sectionId: string;
  itemId: string;
  text: string;
}
export interface SemanticEvidence {
  requirement: string;
  evidence: string;
  sectionId: string;
  itemId: string;
}
export const JD_WEIGHTS = [30, 25, 20, 15, 10] as const;
const aliases: Record<string, string[]> = {
  bigquery: ["bigquery", "google bigquery", "gcp bq", "bq"],
  airflow: ["airflow", "apache airflow"],
  spark: ["spark", "apache spark", "pyspark"],
  hive: ["hive", "apache hive"],
  hdfs: ["hdfs", "hadoop distributed file system"],
  "data modeling": ["data modeling", "data modelling"],
  "data migration": ["data migration", "data conversion", "conv migration"],
  hr: ["hr", "human resources"],
  javascript: ["javascript", "js"],
  typescript: ["typescript", "ts"],
  "node.js": ["node.js", "nodejs", "node js"],
  react: ["react", "react.js", "reactjs"],
  postgresql: ["postgresql", "postgres"],
  "rest api": ["rest api", "rest apis", "restful api", "restful apis"],
};
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/\.(?![\p{L}\p{N}])/gu, " ")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim();
}
export function containsTerm(text: string, term: string) {
  const haystack = ` ${normalize(text)} `;
  return (aliases[normalize(term)] ?? [term]).some((v) =>
    haystack.includes(` ${normalize(v)} `),
  );
}
const stops = new Set(
  "a an the and or to of for in on with you your our will must have be as is are experience required responsibilities ability knowledge strong excellent work working using have has".split(
    " ",
  ),
);
function tokens(text: string) {
  return [
    ...new Set(
      normalize(text)
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stops.has(w)),
    ),
  ];
}
const ratio = (passed: number, total: number) =>
  total ? Math.round((passed * 100) / total) : null;
/** Reproducible heuristic. Semantic evidence is optional, validated by the server, and never treated as an employer verdict. */
export function computeJdMatch(
  input: ReadinessInput,
  jd: JdRequirements,
  semantic: SemanticEvidence[] = [],
  technologies: JdTechnologyEvidence[] = [],
) {
  const tech = (sectionId: string, itemId: string) =>
    technologies
      .filter((t) => t.sectionId === sectionId && t.itemId === itemId)
      .map((t) => t.text);
  const professional = input.sections
    .flatMap((s) => [
      ...s.summary,
      ...s.groups.flatMap((g) => g.items),
      ...s.entries.flatMap((e) => [e.title, ...e.details]),
    ])
    .join("\n");
  const all = [
    professional,
    ...technologies
      .filter((t) =>
        input.sections.some(
          (s) =>
            s.id === t.sectionId && s.entries.some((e) => e.id === t.itemId),
        ),
      )
      .map((t) => t.text),
  ].join("\n");
  const entries = input.sections
    .filter((s) => ["experience", "projects"].includes(s.kind))
    .flatMap((s) => s.entries.map((e) => ({ s, e })));
  const skills = input.sections
    .filter((s) => s.kind === "skills")
    .flatMap((s) => s.groups.flatMap((g) => g.items))
    .join("\n");
  const terms = jd.terms.filter(
    (t, i, a) =>
      a.findIndex((v) => normalize(v.name) === normalize(t.name)) === i,
  );
  const required = terms.some((t) => t.required)
    ? terms.filter((t) => t.required)
    : terms;
  const skillTerms = terms.filter((t) => t.skill);
  const keywordRows = required.map((t) => ({
    term: t.name,
    matched: containsTerm(all, t.name),
  }));
  const skillRows = skillTerms.map((t) => ({
    term: t.name,
    matched:
      containsTerm(skills, t.name) ||
      entries.some(({ s, e }) =>
        containsTerm([...e.details, ...tech(s.id, e.id)].join(" "), t.name),
      ),
  }));
  const responsibilityRows = jd.responsibilities
    .slice(0, 30)
    .map((requirement) => {
      const words = tokens(requirement);
      const candidates = entries
        .map(({ s, e }) => ({
          s,
          e,
          coverage: words.length
            ? words.filter((w) =>
                containsTerm(
                  [e.title, ...e.details, ...tech(s.id, e.id)].join(" "),
                  w,
                ),
              ).length / words.length
            : 0,
        }))
        .sort((a, b) => b.coverage - a.coverage);
      const direct = candidates[0];
      const grounded = semantic.find(
        (v) =>
          v.requirement === requirement &&
          entries.some(
            ({ s, e }) =>
              s.id === v.sectionId &&
              e.id === v.itemId &&
              [...e.details, ...tech(s.id, e.id)].some((d) =>
                d.includes(v.evidence),
              ),
          ),
      );
      const matched =
        !!grounded || !!(direct && words.length >= 2 && direct.coverage >= 0.4);
      const target: ReadinessTarget | null = grounded
        ? {
            type: "entry",
            sectionId: grounded.sectionId,
            itemId: grounded.itemId,
          }
        : direct
          ? { type: "entry", sectionId: direct.s.id, itemId: direct.e.id }
          : null;
      return {
        requirement,
        matched,
        method: grounded ? "semantic" : "term-overlap",
        target,
      };
    });
  const readiness = computeReadiness(input);
  const structure =
    readiness.components.find((c) => c.id === "structure")?.score ?? 0;
  const details = entries.flatMap(({ e }) => e.details).filter((t) => t.trim());
  const readability = all.trim()
    ? (ratio(
        details.filter((t) => {
          const n = tokens(t).length;
          return n >= 3 && n <= 60;
        }).length,
        details.length,
      ) ?? 0)
    : 0;
  const components = [
    {
      id: "keywords",
      label: "Required keywords",
      weight: 30,
      score: ratio(
        keywordRows.filter((r) => r.matched).length,
        keywordRows.length,
      ),
    },
    {
      id: "relevance",
      label: "Experience relevance",
      weight: 25,
      score: ratio(
        responsibilityRows.filter((r) => r.matched).length,
        responsibilityRows.length,
      ),
    },
    {
      id: "skills",
      label: "Skills alignment",
      weight: 20,
      score: ratio(skillRows.filter((r) => r.matched).length, skillRows.length),
    },
    { id: "structure", label: "Structure", weight: 15, score: structure },
    { id: "readability", label: "Readability", weight: 10, score: readability },
  ];
  const partial = components.some((c) => c.score === null);
  const score = partial
    ? null
    : Math.round(
        components.reduce((total, c) => total + (c.score ?? 0) * c.weight, 0) /
          100,
      );
  const checks: ReadinessCheck[] = readiness.checks.filter(
    (c) => c.scored !== false && (
      c.componentId === "detail" ||
      c.componentId === "clarity" ||
      c.componentId === "dates"
    ),
  );
  const skillSection = input.sections.find((s) => s.kind === "skills");
  for (const row of skillRows)
    checks.push({
      id: `jd-skill:${row.term}`,
      componentId: "skills",
      title: `Show evidence for ${row.term}`,
      reason: row.matched
        ? "Visible professional content supports this JD skill."
        : "This JD skill has no matching visible evidence. Add it only if you can support it; AI must not invent it.",
      passed: row.matched,
      target: skillSection
        ? { type: "section", sectionId: skillSection.id }
        : null,
    });
  responsibilityRows.forEach((row, i) =>
    checks.push({
      id: `jd-responsibility:${String(i)}`,
      componentId: "detail",
      title: row.matched
        ? "Responsibility has supporting evidence"
        : "Clarify relevant experience",
      reason:
        `JD: ${row.requirement} ${row.matched ? "Supporting evidence was found." : "No sufficient match found. Describe relevant work only if you did it."}`.slice(
          0,
          700,
        ),
      passed: row.matched,
      target: row.target,
    }),
  );
  return {
    mode: "jd" as const,
    rubricVersion: "jd-local-v1" as const,
    score,
    partial,
    components,
    keywords: keywordRows,
    skills: skillRows,
    responsibilities: responsibilityRows,
    checks: checks.slice(0, 100),
    warnings: [
      "Internal JD heuristic; not an employer ATS score.",
      "Readability estimates visible text, not exported PDF parsing.",
      ...(!terms.some((t) => t.required)
        ? [
            "No required-term labels detected; keyword component uses extracted JD terms.",
          ]
        : []),
      ...(partial
        ? [
            "JD lacks usable criteria for one or more components. No overall score is shown.",
          ]
        : []),
    ],
  };
}
