import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type {
  ParsedResumeContentDto,
  ResumeSectionDto,
  ResumeExperienceEntryDto,
  ResumeEducationEntryDto,
  ResumeProjectEntryDto,
  ResumeSkillGroupDto,
  ResumeBulletDto,
  resumeLinkSchema,
} from "./contracts.js";

type ResumeLink = z.infer<typeof resumeLinkSchema>;

interface RawSection {
  kind: ResumeSectionDto["kind"];
  label: string;
  lines: string[];
}

/**
 * Heuristically parses extracted text into structured resume sections and header info.
 */
export function parseResumeText(rawText: string, fileName?: string): ParsedResumeContentDto {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Extract contact details from anywhere in the text
  const email = extractEmail(rawText);
  const phone = extractPhone(rawText);
  const links = extractLinks(rawText);
  const location = extractLocation(lines.slice(0, 15));

  // 2. Classify text into header lines and section blocks
  const { headerLines, rawSections } = segmentSections(lines);

  // 3. Extract name and headline from header lines
  const { fullName, firstName, lastName, headline } = extractNameAndHeadline(
    headerLines,
    email,
    phone,
  );

  // 4. Parse each section block into structured section DTOs
  const sections: ResumeSectionDto[] = [];

  for (const rawSec of rawSections) {
    switch (rawSec.kind) {
      case "summary": {
        const summaryText = rawSec.lines.join(" ");
        sections.push({
          id: randomUUID(),
          kind: "summary",
          label: rawSec.label,
          hidden: false,
          summary: summaryText,
          entries: [],
          groups: [],
        });
        break;
      }
      case "experience": {
        const entries = parseExperienceSection(rawSec.lines);
        sections.push({
          id: randomUUID(),
          kind: "experience",
          label: rawSec.label,
          hidden: false,
          summary: "",
          entries,
          groups: [],
        });
        break;
      }
      case "education": {
        const entries = parseEducationSection(rawSec.lines);
        sections.push({
          id: randomUUID(),
          kind: "education",
          label: rawSec.label,
          hidden: false,
          summary: "",
          entries,
          groups: [],
        });
        break;
      }
      case "skills": {
        const groups = parseSkillsSection(rawSec.lines);
        sections.push({
          id: randomUUID(),
          kind: "skills",
          label: rawSec.label,
          hidden: false,
          summary: "",
          entries: [],
          groups,
        });
        break;
      }
      case "projects": {
        const entries = parseProjectsSection(rawSec.lines);
        sections.push({
          id: randomUUID(),
          kind: "projects",
          label: rawSec.label,
          hidden: false,
          summary: "",
          entries,
          groups: [],
        });
        break;
      }
      case "certifications":
      case "languages": {
        const bullets: ResumeBulletDto[] = rawSec.lines.map((text) => ({
          id: randomUUID(),
          text: cleanBullet(text),
          hidden: false,
        }));
        sections.push({
          id: randomUUID(),
          kind: rawSec.kind,
          label: rawSec.label,
          hidden: false,
          summary: "",
          entries: [
            {
              id: randomUUID(),
              title: rawSec.label,
              bullets,
            },
          ],
          groups: [],
        });
        break;
      }
    }
  }

  const title = fileName
    ? fileName.replace(/\.[^/.]+$/, "").trim()
    : fullName
      ? `${fullName}'s Resume`
      : "Imported Resume";

  return {
    title: title.slice(0, 200),
    header: {
      fullName,
      firstName,
      lastName,
      headline,
      city: location.city,
      state: location.state,
      country: location.country,
      email,
      phone,
      links,
    },
    sampleContact: {
      email,
      phone,
    },
    sections,
    rawText: rawText.slice(0, 500_000),
  };
}

/** Regex patterns for section headers */
const SECTION_PATTERNS: { kind: ResumeSectionDto["kind"]; regex: RegExp; defaultLabel: string }[] =
  [
    {
      kind: "summary",
      regex: /^(?:(?:professional\s+)?summary|profile|about\s+me|objective|executive\s+summary)$/i,
      defaultLabel: "Professional summary",
    },
    {
      kind: "experience",
      regex: /^(?:(?:work\s+|professional\s+)?experience|employment(?:\s+history)?|work\s+history)$/i,
      defaultLabel: "Work experience",
    },
    {
      kind: "education",
      regex: /^(?:education|academic\s+(?:background|history)|degrees|qualifications)$/i,
      defaultLabel: "Education",
    },
    {
      kind: "skills",
      regex: /^(?:(?:technical\s+|core\s+)?skills|technologies|competencies|areas\s+of\s+expertise|tools)$/i,
      defaultLabel: "Skills",
    },
    {
      kind: "projects",
      regex: /^(?:(?:personal\s+|key\s+|selected\s+)?projects)$/i,
      defaultLabel: "Projects",
    },
    {
      kind: "certifications",
      regex: /^(?:certifications|certificates|licenses|courses)$/i,
      defaultLabel: "Certifications",
    },
    {
      kind: "languages",
      regex: /^(?:languages)$/i,
      defaultLabel: "Languages",
    },
  ];

function segmentSections(lines: string[]): {
  headerLines: string[];
  rawSections: RawSection[];
} {
  const headerLines: string[] = [];
  const rawSections: RawSection[] = [];
  let currentSection: RawSection | null = null;

  for (const line of lines) {
    const isBulletLine = isBullet(line);
    const matchedPattern = !isBulletLine
      ? SECTION_PATTERNS.find(
          (p) =>
            p.regex.test(line) ||
            (line.length <= 40 && p.regex.test(line.replace(/[:\-_]/g, "").trim())),
        )
      : undefined;

    if (matchedPattern) {
      if (currentSection) {
        rawSections.push(currentSection);
      }
      currentSection = {
        kind: matchedPattern.kind,
        label: line.length <= 40 ? line : matchedPattern.defaultLabel,
        lines: [],
      };
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  if (currentSection) {
    rawSections.push(currentSection);
  }

  return { headerLines, rawSections };
}

function extractNameAndHeadline(
  headerLines: string[],
  email: string,
  phone: string,
): { fullName: string; firstName: string; lastName: string; headline: string } {
  let fullName = "";
  let headline = "";

  for (const line of headerLines) {
    if (
      (email.length > 0 && line.includes(email)) ||
      (phone.length > 0 && line.includes(phone)) ||
      isContactOrUrlLine(line)
    ) {
      continue;
    }
    if (!fullName && line.length >= 2 && line.length <= 50 && !/^\d+$/.test(line)) {
      fullName = line;
      continue;
    }
    if (fullName && !headline && line.length <= 80) {
      headline = line;
      break;
    }
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");

  return { fullName, firstName, lastName, headline };
}

function extractEmail(text: string): string {
  const match = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.exec(text);
  return match ? match[0].toLowerCase() : "";
}

function extractPhone(text: string): string {
  const match = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.exec(text);
  return match ? match[0].trim() : "";
}

function extractLinks(text: string): ResumeLink[] {
  const links: ResumeLink[] = [];
  const linkedinMatch = /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i.exec(text);
  if (linkedinMatch && linkedinMatch[1]) {
    links.push({
      id: randomUUID(),
      label: "LinkedIn",
      url: `https://www.linkedin.com/in/${linkedinMatch[1]}`,
    });
  }

  const githubMatch = /github\.com\/([a-zA-Z0-9_-]+)/i.exec(text);
  if (githubMatch && githubMatch[1]) {
    links.push({
      id: randomUUID(),
      label: "GitHub",
      url: `https://github.com/${githubMatch[1]}`,
    });
  }

  const generalUrlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = generalUrlRegex.exec(text)) !== null) {
    const url = urlMatch[0];
    if (!links.some((l) => l.url.includes(url) || url.includes(l.url))) {
      links.push({
        id: randomUUID(),
        label: "Website",
        url,
      });
    }
  }

  return links;
}

function extractLocation(lines: string[]): { city: string; state: string; country: string } {
  const locRegex = /([a-zA-Z\s]+),\s*([A-Z]{2}|[a-zA-Z\s]+)/;
  for (const line of lines) {
    const match = locRegex.exec(line);
    if (match && match[1] && match[2] && !line.includes("@") && !line.includes("http")) {
      return {
        city: match[1].trim(),
        state: match[2].trim(),
        country: "",
      };
    }
  }
  return { city: "", state: "", country: "" };
}

function isContactOrUrlLine(line: string): boolean {
  return (
    line.includes("@") ||
    line.includes("http") ||
    line.includes("linkedin") ||
    line.includes("github") ||
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(line)
  );
}

const DATE_RANGE_REGEX =
  /\b(?:\d{4}(?:-\d{2})?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}[/.-])\s*\d{4})\s*(?:-|–|—|to)\s*(?:Present|Current|\d{4}(?:-\d{2})?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}[/.-])\s*\d{4})\b/i;

function parseExperienceSection(lines: string[]): ResumeExperienceEntryDto[] {
  const entries: ResumeExperienceEntryDto[] = [];
  let currentEntry: ResumeExperienceEntryDto | null = null;

  for (const line of lines) {
    const isBulletLine = isBullet(line);

    if (!isBulletLine) {
      const dateMatch = DATE_RANGE_REGEX.exec(line);
      const isStandaloneDate = dateMatch && line.replace(dateMatch[0], "").trim().length < 5;

      if (isStandaloneDate && currentEntry && !currentEntry.startDate) {
        const { startDate, endDate, isCurrent } = parseDateRange(dateMatch[0]);
        currentEntry.startDate = startDate;
        currentEntry.endDate = endDate;
        currentEntry.isCurrent = isCurrent;
        continue;
      }

      if (dateMatch || currentEntry === null || currentEntry.bullets.length > 0) {
        // Start a new experience entry
        let datesStr = "";
        let lineWithoutDates = line;

        if (dateMatch) {
          datesStr = dateMatch[0];
          lineWithoutDates = line.replace(dateMatch[0], "").trim();
        }

        const { startDate, endDate, isCurrent } = parseDateRange(datesStr);
        const { title, company, location } = parseTitleAndCompany(lineWithoutDates);

        currentEntry = {
          id: randomUUID(),
          title: title || "Role",
          subtitle: company || "",
          location,
          startDate,
          endDate,
          isCurrent,
          bullets: [],
          hidden: false,
        };
        entries.push(currentEntry);
        continue;
      }

      // Secondary non-bullet line right below title: might be company/location
      if (!currentEntry.subtitle && line.length <= 100) {
        currentEntry.subtitle = line;
        continue;
      }
    }

    if (currentEntry) {
      currentEntry.bullets.push({
        id: randomUUID(),
        text: cleanBullet(line),
        hidden: false,
      });
    }
  }

  return entries;
}

function parseEducationSection(lines: string[]): ResumeEducationEntryDto[] {
  const entries: ResumeEducationEntryDto[] = [];
  let currentEntry: ResumeEducationEntryDto | null = null;

  for (const line of lines) {
    const isBulletLine = isBullet(line);

    if (!isBulletLine) {
      const dateMatch = DATE_RANGE_REGEX.exec(line);
      const isStandaloneDate = dateMatch && line.replace(dateMatch[0], "").trim().length < 5;

      if (isStandaloneDate && currentEntry && !currentEntry.startDate) {
        const { startDate, endDate } = parseDateRange(dateMatch[0]);
        currentEntry.startDate = startDate;
        currentEntry.endDate = endDate;
        continue;
      }

      const isDegreeLine = /bachelor|master|doctor|b\.s\.|m\.s\.|b\.a\.|m\.a\.|ph\.d\.|associate|diploma|degree/i.test(line);
      const isInstitutionLine = /university|college|institute|school|academy/i.test(line);

      if (dateMatch || isDegreeLine || isInstitutionLine || currentEntry === null) {
        let datesStr = "";
        let lineClean = line;

        if (dateMatch) {
          datesStr = dateMatch[0];
          lineClean = line.replace(dateMatch[0], "").trim();
        }

        const { startDate, endDate } = parseDateRange(datesStr);
        const gpaMatch = /GPA[:\s]+([0-4]\.\d{1,2}(?:\s*\/\s*4\.0)?)/i.exec(line);
        const grade = gpaMatch && gpaMatch[1] ? gpaMatch[1] : "";

        if (gpaMatch) {
          lineClean = lineClean.replace(gpaMatch[0], "").trim();
        }

        let title = lineClean;
        let subtitle = "";
        let fieldOfStudy = "";

        if (lineClean.includes(" - ") || lineClean.includes(" | ")) {
          const parts = lineClean.split(/\s*[-|]\s*/);
          title = parts[0] ?? lineClean;
          subtitle = parts[1] ?? "";
          fieldOfStudy = parts[2] ?? "";
        }

        currentEntry = {
          id: randomUUID(),
          title: title || "Institution",
          subtitle: subtitle || "Degree",
          fieldOfStudy,
          startDate,
          endDate,
          grade,
          hidden: false,
        };
        entries.push(currentEntry);
        continue;
      }
    }

    if (currentEntry && line.length <= 150) {
      const gpaMatch = /GPA[:\s]+([0-4]\.\d{1,2}(?:\s*\/\s*4\.0)?)/i.exec(line);
      if (gpaMatch && gpaMatch[1]) {
        currentEntry.grade = gpaMatch[1];
        continue;
      }
      if (!currentEntry.fieldOfStudy && /computer science|engineering|business|arts|science/i.test(line)) {
        currentEntry.fieldOfStudy = line;
      }
    }
  }

  return entries;
}

function parseSkillsSection(lines: string[]): ResumeSkillGroupDto[] {
  const groups: ResumeSkillGroupDto[] = [];

  for (const line of lines) {
    if (line.includes(":") && line.indexOf(":") < 40) {
      // E.g. "Languages: JavaScript, TypeScript, Python"
      const [category = "", itemsStr = ""] = line.split(":", 2);
      const items = splitSkills(itemsStr).map((skill) => ({
        id: randomUUID(),
        text: skill,
        hidden: false,
      }));

      if (items.length > 0) {
        groups.push({
          id: randomUUID(),
          label: category.trim(),
          items,
        });
      }
    } else {
      // Comma-separated or bullet-separated skills
      const items = splitSkills(line).map((skill) => ({
        id: randomUUID(),
        text: skill,
        hidden: false,
      }));

      if (items.length > 0) {
        let defaultGroup = groups.find((g) => g.label === "General");
        if (!defaultGroup) {
          defaultGroup = {
            id: randomUUID(),
            label: "General",
            items: [],
          };
          groups.push(defaultGroup);
        }
        defaultGroup.items.push(...items);
      }
    }
  }

  return groups;
}

function parseProjectsSection(lines: string[]): ResumeProjectEntryDto[] {
  const entries: ResumeProjectEntryDto[] = [];
  let currentEntry: ResumeProjectEntryDto | null = null;

  for (const line of lines) {
    const isBulletLine = isBullet(line);

    if (!isBulletLine) {
      if (currentEntry === null || currentEntry.bullets.length > 0) {
        let title = line;
        let technologies = "";

        if (line.includes(" | ") || line.includes(" - ")) {
          const parts = line.split(/\s*[|-]\s*/);
          title = parts[0] ?? line;
          technologies = parts[1] ?? "";
        }

        currentEntry = {
          id: randomUUID(),
          title: title.trim(),
          subtitle: "",
          description: "",
          technologies: technologies.trim(),
          bullets: [],
          links: [],
          hidden: false,
        };
        entries.push(currentEntry);
        continue;
      }
    }

    if (currentEntry) {
      currentEntry.bullets.push({
        id: randomUUID(),
        text: cleanBullet(line),
        hidden: false,
      });
    }
  }

  return entries;
}

function isBullet(line: string): boolean {
  return /^[•\-*–—\u2022\u25E6\u2023]\s+|^\d+\.\s+/.test(line);
}

function cleanBullet(line: string): string {
  return line.replace(/^[•\-*–—\u2022\u25E6\u2023]\s+|^\d+\.\s+/, "").trim();
}

function splitSkills(str: string): string[] {
  return str
    .split(/[,•|;]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 50);
}

function parseDateRange(dateStr: string): {
  startDate: string;
  endDate: string;
  isCurrent: boolean;
} {
  if (!dateStr) {
    return { startDate: "", endDate: "", isCurrent: false };
  }

  const parts = dateStr.split(/\s+[-–—]\s+|\s+to\s+/i).map((s) => s.trim());
  const startDate = normalizeDate(parts[0] ?? "");
  const endRaw = parts[1] ?? "";
  const isCurrent = /present|current/i.test(endRaw);
  const endDate = isCurrent ? "Present" : normalizeDate(endRaw);

  return { startDate, endDate, isCurrent };
}

function normalizeDate(str: string): string {
  // If already YYYY-MM
  const yyyyMm = /\b([12]\d{3})-(0[1-9]|1[0-2])\b/.exec(str);
  if (yyyyMm && yyyyMm[1] && yyyyMm[2]) {
    return `${yyyyMm[1]}-${yyyyMm[2]}`;
  }

  // Extract 4-digit year
  const yearMatch = /\b([12]\d{3})\b/.exec(str);
  if (!yearMatch || !yearMatch[1]) return str.slice(0, 30);

  // Extract month name
  const monthMatch =
    /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i.exec(
      str,
    );

  if (monthMatch && monthMatch[1]) {
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const mStr = monthMatch[1].toLowerCase();
    const monthNum = String(
      monthNames.findIndex((m) =>
        mStr.startsWith(m.toLowerCase()),
      ) + 1,
    ).padStart(2, "0");
    return `${yearMatch[1]}-${monthNum}`;
  }

  return yearMatch[1];
}

function parseTitleAndCompany(str: string): {
  title: string;
  company: string;
  location: string;
} {
  const parts = str.split(/\s*[-–|,@]\s*/).map((s) => s.trim());
  return {
    title: parts[0] ?? "Role",
    company: parts[1] ?? "",
    location: parts[2] ?? "",
  };
}
