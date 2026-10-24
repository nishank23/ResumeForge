import {
  ATS_RUBRIC,
  atsAssessmentSchema,
  atsRequirementSchema,
  type AtsAssessment,
  type AtsAssessmentInput,
} from "@resume-forge/shared-types";
import { z } from "zod";

/** Provider responses contain evidence judgments only. Numeric scores are never accepted. */
export const atsProviderResultSchema = z
  .object({
    requirements: z.array(atsRequirementSchema).min(1).max(60),
  })
  .strict();
export class AtsUnavailable extends Error {
  constructor(message = "Job analysis is unavailable. Retry shortly.") {
    super(message);
  }
}
// Reject a clearly negative source context even if a model quotes only the skill word.
// These are evidence-integrity guards, not criteria that add or subtract score points.
const clearlyNegated =
  /\b(?:never\s+(?:used|worked|built|managed|performed|earned|held|obtained|had|have|been|administered)|(?:do|does|did|have|has|had|am|is|are|was|were)\s+not\s+(?:have|has|had|use|used|using|work|worked|experienced|hold|held|certified|licensed|qualified|familiar|proficient|skilled|able)|(?:don['’]t|doesn['’]t|didn['’]t|haven['’]t|hasn['’]t)\s+(?:have|use|used|work|worked|held|earned|obtained)|no\s+(?:prior\s+)?(?:experience|knowledge|proficiency|license|licence|certification|background)|lack(?:s|ed|ing)?\s+(?:(?:any|the|relevant|required)\s+)?(?:experience|knowledge|skills?|qualifications?|license|licence|certification)|unfamiliar\s+with|not\s+(?:yet\s+)?(?:certified|licensed|qualified|proficient|experienced|familiar)|not\s+[\p{L}\p{N}+#.]+\s*$)/iu;
function hasNonNegatedOccurrence(text: string, quote: string): boolean {
  let start = text.indexOf(quote);
  while (start !== -1) {
    let left = 0;
    const prefix = text.slice(0, start);
    for (const match of prefix.matchAll(/[.!?]\s+|\n/gu))
      left = match.index + match[0].length;
    const after = start + quote.length;
    const boundary = text.slice(after).search(/[.!?](?:\s|$)|\n/u);
    const right = boundary < 0 ? text.length : after + boundary;
    if (!clearlyNegated.test(text.slice(left, right))) return true;
    start = text.indexOf(quote, start + Math.max(1, quote.length));
  }
  return false;
}
export function assessEvidence(
  input: AtsAssessmentInput,
  raw: unknown,
  model: string,
): AtsAssessment {
  try {
    const { requirements } = atsProviderResultSchema.parse(raw);
    const sources = new Map(
      input.sources.map((source) => [source.id, source.text]),
    );
    for (const row of requirements) {
      if (!input.jdText.includes(row.jdQuote)) throw new Error();
      for (const item of row.evidence) {
        const source = sources.get(item.sourceId);
        if (!source || !source.includes(item.quote)) throw new Error();
        if (
          row.status === "supported" &&
          !hasNonNegatedOccurrence(source, item.quote)
        )
          throw new Error();
      }
    }
    const count = (importance: "required" | "preferred") => {
      const rows = requirements.filter((row) => row.importance === importance);
      return {
        supported: rows.filter((row) => row.status === "supported").length,
        total: rows.length,
      };
    };
    const coverage = {
      required: count("required"),
      preferred: count("preferred"),
    };
    const selected = coverage.required.total
      ? coverage.required
      : coverage.preferred;
    return atsAssessmentSchema.parse({
      rubricVersion: ATS_RUBRIC,
      model,
      score: selected.total
        ? Math.round((100 * selected.supported) / selected.total)
        : null,
      coverage,
      requirements,
      warnings: [
        "This measures evidence for this job description, not an employer ATS score or a hiring prediction.",
        ...(requirements.some((row) => row.status === "uncertain")
          ? [
              "Uncertain requirements receive no supported credit; review their evidence.",
            ]
          : []),
        ...(!coverage.required.total
          ? [
              "No mandatory requirements were identified; score uses stated preferences.",
            ]
          : []),
      ],
    });
  } catch {
    throw new AtsUnavailable(
      "Job requirements or source evidence could not be verified. Retry analysis.",
    );
  }
}
export type AtsAssessor = (
  input: AtsAssessmentInput,
  signal?: AbortSignal,
) => Promise<AtsAssessment>;
