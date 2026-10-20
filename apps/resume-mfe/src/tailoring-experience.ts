import { containsTerm } from "@resume-forge/resume-core";
import {
  tailoringFactsSchema,
  tailoringAnswerIssue,
  type EditorDocument,
  type RichDocument,
  type TailoringFact,
} from "@resume-forge/shared-types";

export type ExperienceAnswer = Omit<TailoringFact, "confirmed">;
export const experienceQuestions = [
  {
    kind: "contribution",
    label: "What did you do, and what problem did it solve?",
    hint: "Describe your own contribution, who needed it and any important decisions or challenges.",
  },
  {
    kind: "tools",
    label: "Which tools did you actually use?",
    hint: "Separate tools with commas, for example Python, PostgreSQL. Leave out tools you have not used.",
  },
  {
    kind: "outcome",
    label: "What changed because of your work?",
    hint: "Share a real result or useful extra detail. Numbers are optional; leave this blank if the result is unknown.",
  },
] as const;
// Retain editable answers when reopening runs from the longer questionnaire.
export const previousExperienceQuestions = [
  {
    kind: "context",
    label: "What problem were you solving?",
    hint: "Explain who needed this work and what was difficult about it.",
  },
  {
    kind: "details",
    label: "What else should this application show?",
    hint: "Add a relevant responsibility, technical decision or challenge you handled.",
  },
] as const;
export function experienceQuestionLabel(kind: TailoringFact["kind"]): string {
  const question = [
    ...experienceQuestions,
    ...previousExperienceQuestions,
  ].find((question) => question.kind === kind);
  return question?.label ?? "Additional detail";
}
function plain(node: RichDocument | RichDocument["content"][number]): string {
  if (node.type === "paragraph")
    return (node.content ?? [])
      .map((i) => (i.type === "text" ? i.text : "\n"))
      .join("");
  if (node.type === "bulletList")
    return node.content.map((i) => i.content.map(plain).join("\n")).join("\n");
  return node.content.map(plain).join("\n");
}
export function experienceEntries(doc: EditorDocument) {
  return doc.sections
    .filter((s) => !s.hidden && ["experience", "projects"].includes(s.kind))
    .flatMap((s) =>
      s.entries
        .filter((e) => !e.hidden)
        .map((e) => {
          const description = [
            plain(e.description),
            ...e.bullets.filter((b) => !b.hidden).map((b) => b.text),
          ]
            .filter(Boolean)
            .join("\n");
          return {
            sectionId: s.id,
            itemId: e.id,
            title: e.title || s.label,
            kind: s.kind,
            description,
            tools: e.technologies,
            thin: description.trim().split(/\s+/).filter(Boolean).length < 40,
          };
        }),
    )
    .sort((a, b) => Number(b.thin) - Number(a.thin));
}
export type ExperiencePrompt = (typeof experienceQuestions)[number] & {
  entry: ReturnType<typeof experienceEntries>[number];
  reason: string;
};

/** Local suggestions only: this does not change ATS scoring or assert new facts. */
export function experiencePrompts(
  doc: EditorDocument,
  terms: readonly string[] = [],
): ExperiencePrompt[] {
  const skills = doc.sections
    .filter((section) => !section.hidden && section.kind === "skills")
    .flatMap((section) =>
      section.groups.flatMap((group) =>
        group.items.filter((item) => !item.hidden).map((item) => item.text),
      ),
    );
  const ranked = experienceEntries(doc)
    .map((entry, order) => {
      const text = [entry.title, entry.description, entry.tools].join(" ");
      const matched = terms.filter((term) => containsTerm(text, term));
      const toolsPresent =
        !!entry.tools.trim() ||
        [...terms, ...skills].some((term) =>
          containsTerm(entry.description, term),
        );
      const outcomePresent =
        /\b(reduced|reducing|improved|increased|saved|supported|supports|enabled|enables|enabling|helped|resolved|processed|handled)\b|\d+(?:[.,]\d+)?\s*(?:%|users?\b|customers?\b|hours?\b)|\b(?:not measured|no measured|result unknown)\b/i.test(
          entry.description,
        );
      const questions = experienceQuestions
        .filter((question) =>
          question.kind === "contribution"
            ? entry.thin
            : question.kind === "tools"
              ? !toolsPresent
              : !!entry.description.trim() && !outcomePresent,
        )
        .map((question) => ({
          ...question,
          entry,
          reason:
            question.kind === "contribution"
              ? "This entry has little detail about your own contribution."
              : question.kind === "tools"
                ? "Tools are not clear in this entry. Add only those you used."
                : "A real result or useful outcome could make this entry clearer. Skip if unknown.",
        }));
      return { questions, relevance: matched.length, order };
    })
    .filter((row) => row.questions.length)
    .sort((a, b) => b.relevance - a.relevance || a.order - b.order);
  const related = ranked.filter((row) => row.relevance > 0);
  const candidates = related.length ? related : ranked;
  // Ask about each relevant entry before asking another question about the same one.
  return [
    ...candidates.flatMap((row) => row.questions.slice(0, 1)),
    ...candidates.flatMap((row) => row.questions.slice(1)),
  ].slice(0, 3);
}

export function confirmExperience(
  doc: EditorDocument,
  answers: ExperienceAnswer[],
): TailoringFact[] {
  const entries = experienceEntries(doc);
  for (const answer of answers) {
    const issue = tailoringAnswerIssue(answer.text);
    if (issue) throw new Error(issue);
  }
  const parsed = tailoringFactsSchema.safeParse(
    answers
      .filter((a) => a.text.trim())
      .map((a) => ({ ...a, text: a.text.trim(), confirmed: true })),
  );
  if (!parsed.success)
    throw new Error(
      "Use up to 30 unique answers, with no more than 2,000 characters each and 16,000 in total.",
    );
  const facts = parsed.data;
  if (
    facts.some(
      (f) =>
        !entries.some(
          (e) => e.sectionId === f.sectionId && e.itemId === f.itemId,
        ),
    )
  )
    throw new Error(
      "An answer no longer belongs to a visible entry. Reopen the saved resume.",
    );
  return facts;
}
