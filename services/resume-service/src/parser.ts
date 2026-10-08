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
export function parseResumeText(
  rawText: string,
  fileName?: string,
): ParsedResumeContentDto {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Extract contact details from anywhere in the text
  const email = extractEmail(rawText);
  const phone = extractPhone(rawText);

  // 2. Classify text into header lines and section blocks
  const { headerLines, rawSections } = segmentSections(lines);

  const location = extractLocation(headerLines);
  const links = extractLinks(headerLines.join("\n"));

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
const SECTION_PATTERNS: {
  kind: ResumeSectionDto["kind"];
  regex: RegExp;
  defaultLabel: string;
}[] = [
  {
    kind: "summary",
    regex:
      /^(?:(?:professional\s+)?summary|profile|about\s+me|objective|executive\s+summary)$/i,
    defaultLabel: "Professional summary",
  },
  {
    kind: "experience",
    regex:
      /^(?:(?:work\s+|professional\s+)?experiences?|employment(?:\s+history)?|work\s+history)$/i,
    defaultLabel: "Work experience",
  },
  {
    kind: "education",
    regex:
      /^(?:educations?|academic\s+(?:background|history)|degrees|qualifications)$/i,
    defaultLabel: "Education",
  },
  {
    kind: "skills",
    regex:
      /^(?:(?:technical\s+|core\s+)?skills|technologies|competencies|areas\s+of\s+expertise|tools)$/i,
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
            (line.length <= 40 &&
              p.regex.test(line.replace(/[:\-_]/g, "").trim())),
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
    if (
      !fullName &&
      line.length >= 2 &&
      line.length <= 50 &&
      !/^\d+$/.test(line)
    ) {
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
  const match =
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.exec(text);
  return match ? match[0].trim() : "";
}

function extractLinks(text: string): ResumeLink[] {
  const urls = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/gi))
    urls.add(match[0].replace(/[),.;]+$/, ""));
  for (const match of text.matchAll(
    /(?:www\.)?(linkedin\.com\/in\/[a-zA-Z0-9_-]+|github\.com\/[a-zA-Z0-9_/-]+)/gi,
  )) {
    if (![...urls].some((url) => url.includes(match[0])))
      urls.add(
        "https://" +
          (match[0].startsWith("linkedin.com") ? "www." : "") +
          match[0],
      );
  }
  return [...urls].map((url) => ({
    id: randomUUID(),
    label: /linkedin\.com/i.test(url)
      ? "LinkedIn"
      : /github\.com/i.test(url)
        ? "GitHub"
        : "Website",
    url,
  }));
}

function extractLocation(lines: string[]): {
  city: string;
  state: string;
  country: string;
} {
  // Only header cells can be a contact location; never scan summary or jobs.
  for (const line of lines) {
    const cells = line
      .split(/\t|[|•]/)
      .map((s) => s.trim())
      .reverse();
    for (const cell of cells) {
      const match = /^([\p{L} .'-]+),\s*([\p{L} .'-]+)$/u.exec(cell);
      if (match?.[1] && match[2])
        return { city: match[1].trim(), state: match[2].trim(), country: "" };
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

const DATE_TOKEN = String.raw`(?:[12]\d{3}(?:-\d{2})?|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}[/.-])\s*[12]\d{3})`;
const DATE_RANGE_REGEX = new RegExp(
  `\\b(${DATE_TOKEN})\\s*(?:[-–—]|to)\\s*(${DATE_TOKEN}|Present|Current)\\b`,
  "i",
);
const EMPLOYMENT =
  /\b(?:full[- ]time|part[- ]time|contract|internship|freelance|temporary)\b/i;
const LOCATION_TYPE = /\b(?:on[- ]site|remote|hybrid)\b/i;
const TECHNOLOGIES =
  /^(?:technologies|technology|tech stack|tools)(?:\s*\/\s*(?:skills|tools))?(?:\s+used)?\s*:\s*(.*)$/i;
interface ParsedEntry {
  id: string;
  title: string;
  subtitle: string;
  location: string;
  employmentType: string;
  locationType: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  fieldOfStudy: string;
  grade: string;
  description: string;
  technologies: string;
  bullets: ResumeBulletDto[];
  links: ResumeLink[];
  hidden: boolean;
}
function parseStructuredEntries(
  lines: string[],
  kind: "experience" | "education" | "projects",
): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  let entry: ParsedEntry | undefined,
    metadata = false;
  for (let i = 0; i < lines.length; i++) {
    const original = lines[i] ?? "",
      explicitBullet = isBullet(original);
    let line = cleanBullet(original)
      .replace(/^[|•\s]+|[|\s]+$/g, "")
      .trim();
    if (!line) continue;
    const tech = TECHNOLOGIES.exec(line);
    if (tech && entry) {
      entry.technologies = tech[1]?.trim() ?? "";
      metadata = false;
      continue;
    }
    const date = DATE_RANGE_REGEX.exec(line);
    const dateOnly = date && !line.replace(date[0], "").replace(/[|\s]/g, "");
    if (entry && dateOnly && !entry.startDate) {
      Object.assign(entry, parseDateRange(date[0]));
      continue;
    }
    const upcoming = lines
      .slice(i + 1, i + 3)
      .some((l) => DATE_RANGE_REGEX.test(l));
    const titleWithDates =
      !!date && !dateOnly && line.length < 250 && !/[.!?]$/.test(line);
    const startsEntry =
      !explicitBullet &&
      (!entry ||
        titleWithDates ||
        (upcoming &&
          !metadata &&
          !/[.!?]$/.test(line) &&
          !TECHNOLOGIES.test(line)));
    if (startsEntry) {
      const links = extractLinks(line);
      line = line
        .replace(/https?:\/\/\S+/gi, "")
        .replace(DATE_RANGE_REGEX, "")
        .replace(/[|\t\s]+$/g, "")
        .trim();
      const employmentType =
        kind === "experience" ? (EMPLOYMENT.exec(line)?.[0] ?? "") : "";
      if (employmentType)
        line = line
          .replace(EMPLOYMENT, "")
          .replace(/[|\s]+$/g, "")
          .trim();
      const parts = line
        .split(/\s+[|–—-]\s+|\t+/)
        .map((s) => s.trim())
        .filter(Boolean);
      entry = {
        id: randomUUID(),
        title: parts[0] ?? "",
        subtitle: parts[1] ?? "",
        location: kind === "experience" ? parts.slice(2).join(", ") : "",
        employmentType,
        locationType: "",
        ...parseDateRange(date?.[0] ?? ""),
        fieldOfStudy: kind === "education" ? parts.slice(2).join(" - ") : "",
        grade: "",
        description: "",
        technologies: kind === "projects" ? parts.slice(1).join(", ") : "",
        bullets: [],
        links,
        hidden: false,
      };
      // Legacy project title | stack is technologies, not a project role.
      if (kind === "projects") entry.subtitle = "";
      entries.push(entry);
      metadata = true;
      continue;
    }
    if (!entry) continue;
    if (dateOnly) {
      Object.assign(entry, parseDateRange(date[0]));
      continue;
    }
    const locationType = LOCATION_TYPE.exec(line)?.[0];
    if (kind === "experience" && locationType && metadata) {
      const cells = line
        .split(/\t+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (cells.length > 1 && !entry.subtitle) entry.subtitle = cells[0] ?? "";
      entry.locationType = locationType;
      entry.location = (cells.at(-1) ?? line)
        .replace(LOCATION_TYPE, "")
        .replace(/^[|•\s]+/g, "")
        .trim();
      metadata = false;
      continue;
    }
    if (kind === "education") {
      const grade = /GPA[:\s]+([0-4]\.\d{1,2}(?:\s*\/\s*4\.0)?)/i.exec(line);
      if (grade?.[1]) {
        entry.grade = grade[1];
        continue;
      }
      if (
        metadata &&
        /bachelor|master|doctor|b\.?\s?tech|m\.?\s?tech|b\.s\.|m\.s\.|b\.a\.|m\.a\.|ph\.d\.|associate|diploma|degree/i.test(
          line,
        )
      ) {
        const parts = line.split(/\s+[|–—-]\s+/);
        entry.subtitle = parts[0] ?? line;
        entry.fieldOfStudy = parts.slice(1).join(" - ");
        metadata = false;
        continue;
      }
    }
    if (
      metadata &&
      !explicitBullet &&
      !entry.subtitle &&
      line.length <= 150 &&
      !/[.!?]$/.test(line) &&
      !/^(?:developed|built|created|managed|implemented|executed|delivered|led|designed|maintained)\b/i.test(
        line,
      )
    ) {
      entry.subtitle = line;
      metadata = false;
      continue;
    }
    metadata = false;
    const last = entry.bullets.at(-1);
    // A wrapped paragraph is not a new role/project. Retain all narrative text.
    if (
      !explicitBullet &&
      last &&
      (!/[.!?]$/.test(last.text) || /^[a-z]/.test(line))
    )
      last.text += " " + line.replace(/\s+/g, " ");
    else
      entry.bullets.push({
        id: randomUUID(),
        text: line.replace(/\s+/g, " "),
        hidden: false,
      });
  }
  return entries;
}
function parseExperienceSection(lines: string[]): ResumeExperienceEntryDto[] {
  return parseStructuredEntries(lines, "experience");
}
function parseEducationSection(lines: string[]): ResumeEducationEntryDto[] {
  return parseStructuredEntries(lines, "education");
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
  return parseStructuredEntries(lines, "projects");
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

  const match = DATE_RANGE_REGEX.exec(dateStr);
  const startDate = normalizeDate(match?.[1] ?? dateStr);
  const endRaw = match?.[2] ?? "";
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
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const mStr = monthMatch[1].toLowerCase();
    const monthNum = String(
      monthNames.findIndex((m) => mStr.startsWith(m.toLowerCase())) + 1,
    ).padStart(2, "0");
    return `${yearMatch[1]}-${monthNum}`;
  }

  return yearMatch[1];
}
