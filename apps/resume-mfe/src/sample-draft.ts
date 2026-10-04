import { summaryFromText } from "@resume-forge/shared";
import {
  emptyEntry,
  emptySection,
  groupLanguagesUnderSkills,
  type ResumeDraft,
  type SectionKind,
} from "./editor-draft";
import type { SampleResumeDocument } from "./sample-resume";

export function createSampleDraft(sample: SampleResumeDocument): ResumeDraft {
  const kinds: SectionKind[] = [
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    "languages",
  ];
  const sections = sample.sections.map((source, i) => {
    const kind = kinds[i] ?? "summary";
    const section = emptySection(kind, source.sectionId);
    section.label = source.sectionLabel;
    const presentation = source.presentation;
    if (presentation.kind === "summary")
      section.summary = summaryFromText(source.content);
    if (presentation.kind === "entries")
      section.entries = presentation.entries.map((e) => {
        const entry = emptyEntry(e.id);
        Object.assign(entry, {
          title: e.title,
          subtitle: e.subtitle,
          location: e.location ?? "",
          technologies: e.technologies ?? "",
        });
        const [startYear = "", endYear = ""] = e.period.split("–");
        entry.dates = {
          startYear,
          endYear: endYear === "Present" ? "" : endYear,
          startMonth: "",
          endMonth: "",
          current: endYear === "Present",
          yearOnly: true,
        };
        entry.bullets = e.bullets.map((text, j) => ({
          id: `${e.id}-bullet-${String(j)}`,
          text,
          hidden: false,
        }));
        return entry;
      });
    if (presentation.kind === "skills")
      section.groups = presentation.groups.map((g, j) => ({
        id: `${section.id}-group-${String(j)}`,
        label: g.label,
        items: g.values.split(", ").map((text, k) => ({
          id: `${section.id}-skill-${String(j)}-${String(k)}`,
          text,
          hidden: false,
        })),
      }));
    if (presentation.kind === "languages")
      section.languages = presentation.values.map((text, j) => ({
        id: `${section.id}-language-${String(j)}`,
        text: text.split(" (")[0] ?? "",
        proficiency: text.split(" (")[1]?.replace(")", "") ?? "",
        hidden: false,
      }));
    return section;
  });
  const [firstName = "", ...last] = sample.name.split(" ");
  const [city = "", country = ""] = sample.location.split(", ");
  return groupLanguagesUnderSkills({
    synthetic: true,
    title: sample.title,
    header: {
      firstName,
      lastName: last.join(" "),
      headline: sample.headline,
      city,
      state: "",
      country,
    },
    sampleContact: { phone: sample.phone, email: sample.email },
    sections,
  });
}
