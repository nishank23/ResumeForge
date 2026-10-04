import {
  type ParsedJdContentDto,
  type ParsedKeywordDto,
  parsedJdContentSchema,
} from "./jd-contracts.js";

// Comprehensive catalog of common tech and industry keywords by category
const KEYWORD_CATALOG: Array<{ name: string; category: ParsedKeywordDto["category"]; aliases?: string[] }> = [
  // Languages & Core Runtimes
  { name: "TypeScript", category: "technical" },
  { name: "JavaScript", category: "technical" },
  { name: "Python", category: "technical" },
  { name: "Node.js", category: "technical", aliases: ["Node", "NodeJS"] },
  { name: "Java", category: "technical" },
  { name: "Go", category: "technical", aliases: ["Golang"] },
  { name: "Rust", category: "technical" },
  { name: "C++", category: "technical" },
  { name: "C#", category: "technical", aliases: [".NET", "DotNet"] },
  { name: "Ruby", category: "technical" },
  { name: "PHP", category: "technical" },
  { name: "Swift", category: "technical" },
  { name: "Kotlin", category: "technical" },
  { name: "SQL", category: "technical" },
  { name: "HTML5", category: "technical", aliases: ["HTML"] },
  { name: "CSS3", category: "technical", aliases: ["CSS"] },

  // Frameworks & Libraries
  { name: "React", category: "technical", aliases: ["React.js", "ReactJS"] },
  { name: "Next.js", category: "technical", aliases: ["NextJS"] },
  { name: "Vue.js", category: "technical", aliases: ["Vue", "VueJS"] },
  { name: "Angular", category: "technical" },
  { name: "Svelte", category: "technical" },
  { name: "Tailwind CSS", category: "technical", aliases: ["Tailwind"] },
  { name: "Express", category: "technical", aliases: ["Express.js"] },
  { name: "Fastify", category: "technical" },
  { name: "Hono", category: "technical" },
  { name: "Django", category: "technical" },
  { name: "Flask", category: "technical" },
  { name: "Spring Boot", category: "technical", aliases: ["Spring"] },
  { name: "GraphQL", category: "technical" },
  { name: "REST API", category: "technical", aliases: ["REST", "RESTful"] },
  { name: "gRPC", category: "technical" },

  // Databases & Storage
  { name: "PostgreSQL", category: "tools", aliases: ["Postgres"] },
  { name: "MySQL", category: "tools" },
  { name: "MongoDB", category: "tools", aliases: ["Mongo"] },
  { name: "Redis", category: "tools" },
  { name: "Prisma", category: "tools" },
  { name: "Elasticsearch", category: "tools" },
  { name: "DynamoDB", category: "tools" },
  { name: "Cassandra", category: "tools" },
  { name: "pgvector", category: "tools" },

  // Cloud & Infrastructure / DevOps
  { name: "AWS", category: "tools", aliases: ["Amazon Web Services"] },
  { name: "GCP", category: "tools", aliases: ["Google Cloud", "Google Cloud Platform"] },
  { name: "Azure", category: "tools", aliases: ["Microsoft Azure"] },
  { name: "Docker", category: "tools" },
  { name: "Kubernetes", category: "tools", aliases: ["K8s"] },
  { name: "Terraform", category: "tools" },
  { name: "CI/CD", category: "tools", aliases: ["Continuous Integration"] },
  { name: "GitHub Actions", category: "tools" },
  { name: "Linux", category: "tools" },
  { name: "Kafka", category: "tools" },
  { name: "RabbitMQ", category: "tools" },

  // Architecture & Engineering Practices
  { name: "Microservices", category: "domain" },
  { name: "Microfrontends", category: "domain" },
  { name: "Distributed Systems", category: "domain" },
  { name: "System Design", category: "domain" },
  { name: "TDD", category: "domain", aliases: ["Test Driven Development"] },
  { name: "Performance Optimization", category: "domain" },
  { name: "Security", category: "domain", aliases: ["Cybersecurity", "InfoSec"] },
  { name: "OAuth", category: "domain", aliases: ["OAuth2", "OIDC"] },
  { name: "Machine Learning", category: "domain", aliases: ["ML", "Deep Learning", "AI"] },
  { name: "LLM", category: "domain", aliases: ["Large Language Models", "Generative AI"] },

  // Developer Tools & Testing
  { name: "Git", category: "tools" },
  { name: "GitHub", category: "tools" },
  { name: "GitLab", category: "tools" },
  { name: "Vitest", category: "tools" },
  { name: "Jest", category: "tools" },
  { name: "Cypress", category: "tools" },
  { name: "Playwright", category: "tools" },
  { name: "Jira", category: "tools" },
  { name: "Figma", category: "tools" },

  // Soft Skills & Collaboration
  { name: "Agile", category: "soft_skills", aliases: ["Scrum", "Kanban"] },
  { name: "Communication", category: "soft_skills" },
  { name: "Leadership", category: "soft_skills" },
  { name: "Mentoring", category: "soft_skills" },
  { name: "Problem Solving", category: "soft_skills" },
  { name: "Collaboration", category: "soft_skills", aliases: ["Teamwork"] },
  { name: "Code Review", category: "soft_skills" },

  // Education
  { name: "Computer Science", category: "education", aliases: ["B.S. in Computer Science", "BS CS", "Computer Engineering"] },
];

/**
 * Sanitizes input text to neutralize prompt injections and script tags.
 */
export function sanitizeJdText(rawText: string): string {
  return rawText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\b(ignore (?:all )?previous instructions|system prompt|reveal secrets|DAN mode|jailbreak|disregard previous)\b/gi, "[neutralized-instruction]")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""); // strip non-printable controls
}

interface SplitSections {
  header: string[];
  requirements: string[];
  preferred: string[];
  responsibilities: string[];
  about: string[];
  other: string[];
}

function splitJdSections(lines: string[]): SplitSections {
  const sections: SplitSections = {
    header: [],
    requirements: [],
    preferred: [],
    responsibilities: [],
    about: [],
    other: [],
  };

  type SectionKey = keyof SplitSections;
  let currentSection: SectionKey = "header";

  const reqPattern = /^(?:#+\s*)?(?:requirements|qualifications|what you(?:'ll| will)? bring|what we(?:'re| are) looking for|must[ -]haves?|basic qualifications|minimum qualifications|skills & requirements)/i;
  const prefPattern = /^(?:#+\s*)?(?:preferred qualifications|nice[ -]to[ -]haves?|bonus points|preferred skills|plus if you have|good to have)/i;
  const respPattern = /^(?:#+\s*)?(?:responsibilities|what you(?:'ll| will)? do|key responsibilities|duties|core responsibilities|role overview|the role|scope of work)/i;
  const aboutPattern = /^(?:#+\s*)?(?:about (?:us|the company|our team)|company overview|who we are)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (prefPattern.test(trimmed)) {
      currentSection = "preferred";
      continue;
    }
    if (reqPattern.test(trimmed)) {
      currentSection = "requirements";
      continue;
    }
    if (respPattern.test(trimmed)) {
      currentSection = "responsibilities";
      continue;
    }
    if (aboutPattern.test(trimmed)) {
      currentSection = "about";
      continue;
    }

    // Check if line looks like a major new heading
    if (/^(?:#+\s*)?[A-Z][A-Za-z0-9\s&,/]{2,40}:?$/.test(trimmed) && trimmed.length < 50) {
      // If it doesn't match known sections, put in other
      if (currentSection !== "header") {
        currentSection = "other";
      }
    }

    sections[currentSection].push(trimmed);
  }

  return sections;
}

function extractJobTitle(lines: string[], explicitTitle?: string): string {
  if (explicitTitle && explicitTitle.trim()) {
    return explicitTitle.trim().slice(0, 200);
  }

  for (const line of lines) {
    const match = line.match(/^(?:Job )?Title:\s*(.+)$/i) || line.match(/^(?:Position|Role):\s*(.+)$/i);
    if (match && match[1]) {
      return match[1].trim().slice(0, 200);
    }
  }

  // Look for common title keywords in first 5 lines
  const titleKeywords = /\b(Engineer|Developer|Manager|Architect|Designer|Analyst|Consultant|Director|Lead|Specialist|Scientist|DevOps|Administrator|Coordinator|Officer)\b/i;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const cleanLine = rawLine.replace(/^#+\s*/, "").trim();
    if (titleKeywords.test(cleanLine) && cleanLine.length <= 100) {
      return cleanLine.slice(0, 200);
    }
  }

  // Fallback to first line if reasonably short, else Target Position
  const firstLine = lines[0];
  if (firstLine && firstLine.length <= 100) {
    return firstLine.replace(/^#+\s*/, "").trim().slice(0, 200);
  }

  return "Target Position";
}

function extractCompany(lines: string[], rawText: string, explicitCompany?: string): string {
  if (explicitCompany && explicitCompany.trim()) {
    return explicitCompany.trim().slice(0, 200);
  }

  for (const line of lines) {
    const match = line.match(/^Company:\s*(.+)$/i) || line.match(/^Organization:\s*(.+)$/i);
    if (match && match[1]) {
      return match[1].trim().slice(0, 200);
    }
  }

  const aboutMatch = rawText.match(/About\s+([A-Z][A-Za-z0-9\s&]{2,30}?)(?:,|\.|\n|is\b)/i);
  if (aboutMatch && aboutMatch[1]) {
    return aboutMatch[1].trim().slice(0, 200);
  }

  const joinMatch = rawText.match(/(?:join|at|with)\s+([A-Z][A-Za-z0-9&]{2,25})\b/i);
  if (joinMatch && joinMatch[1]) {
    return joinMatch[1].trim().slice(0, 200);
  }

  return "Target Company";
}

function detectExperienceLevel(text: string, title?: string): ParsedJdContentDto["experienceLevel"] {
  if (title) {
    const titleLower = title.toLowerCase();
    if (/\b(vp|vice president|chief|head of|c-level|executive)\b/i.test(titleLower)) return "executive";
    if (/\b(principal|staff|lead|tech lead)\b/i.test(titleLower)) return "lead";
    if (/\b(senior|sr\.?)\b/i.test(titleLower)) return "senior";
    if (/\b(mid[- ]level|intermediate)\b/i.test(titleLower)) return "mid";
    if (/\b(junior|jr\.?|entry[- ]level|associate|intern)\b/i.test(titleLower)) return "entry";
  }

  const lower = text.toLowerCase();
  if (/\b(vp|vice president|chief|head of|c-level|executive)\b/i.test(lower)) {
    return "executive";
  }
  if (/\b(principal|staff engineer|staff developer|solutions architect|enterprise architect|tech lead)\b/i.test(lower)) {
    return "lead";
  }
  if (/\b(senior|sr\.?|[5-9]\+?\s*years?|10\+\s*years?)\b/i.test(lower)) {
    return "senior";
  }
  if (/\b(mid[- ]level|intermediate|3\+\s*years?|4\s*years?|2[-–]5\s*years?)\b/i.test(lower)) {
    return "mid";
  }
  if (/\b(junior|jr\.?|entry[- ]level|associate|intern|new grad|0[-–]2\s*years?)\b/i.test(lower)) {
    return "entry";
  }
  return "unknown";
}

function detectRoleType(text: string): ParsedJdContentDto["roleType"] {
  const lower = text.toLowerCase();
  if (/\b(intern|internship|co-op)\b/i.test(lower)) return "internship";
  if (/\b(contract|contractor|freelance)\b/i.test(lower)) return "contract";
  if (/\b(part[- ]time)\b/i.test(lower)) return "part-time";
  if (/\b(remote|work from home|wfh|anywhere)\b/i.test(lower)) return "remote";
  if (/\b(hybrid)\b/i.test(lower)) return "hybrid";
  if (/\b(full[- ]time|permanent)\b/i.test(lower)) return "full-time";
  return "full-time";
}

function extractKeywords(
  rawText: string,
  sections: SplitSections,
): ParsedKeywordDto[] {
  const foundKeywords: ParsedKeywordDto[] = [];
  const seen = new Set<string>();

  const reqText = sections.requirements.join("\n").toLowerCase();
  const prefText = sections.preferred.join("\n").toLowerCase();
  const allLines = rawText.split("\n");

  for (const item of KEYWORD_CATALOG) {
    const names = [item.name, ...(item.aliases || [])];
    let matchedName: string | null = null;
    let evidence = "";

    for (const term of names) {
      // Escape for regex word boundary
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, "i");

      if (regex.test(rawText)) {
        matchedName = item.name;
        // Find line containing it for evidence
        for (const line of allLines) {
          if (regex.test(line)) {
            evidence = line.trim().slice(0, 300);
            break;
          }
        }
        break;
      }
    }

    if (matchedName && !seen.has(matchedName)) {
      seen.add(matchedName);

      // Determine if required or preferred
      const lowerName = matchedName.toLowerCase();
      const inReqSection = reqText.includes(lowerName);
      const inPrefSection = prefText.includes(lowerName);
      const isExplicitMust = /\b(must have|required|essential|minimum)\b/i.test(evidence);

      const required = isExplicitMust || (inReqSection && !inPrefSection);

      foundKeywords.push({
        name: matchedName,
        category: item.category,
        required,
        evidence: evidence || `Found in job description: ${matchedName}`,
      });
    }
  }

  return foundKeywords;
}

function cleanBullets(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/^[-*•–—\d.)\s]+/, "").trim())
    .filter((line) => line.length > 5)
    .slice(0, 30);
}

/**
 * Parses raw Job Description text into structured ParsedJdContentDto.
 */
export function parseJdText(
  rawJD: string,
  explicitTitle?: string,
  explicitCompany?: string,
): ParsedJdContentDto {
  const sanitized = sanitizeJdText(rawJD);
  const lines = sanitized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const sections = splitJdSections(lines);
  const jobTitle = extractJobTitle(lines, explicitTitle);
  const company = extractCompany(lines, sanitized, explicitCompany);
  const experienceLevel = detectExperienceLevel(sanitized, jobTitle);
  const roleType = detectRoleType(sanitized);

  const requirements = cleanBullets(
    sections.requirements.length > 0 ? sections.requirements : lines.filter((l) => /^[•*-]\s+/.test(l)),
  );
  const responsibilities = cleanBullets(
    sections.responsibilities.length > 0
      ? sections.responsibilities
      : lines.filter((l) => /\b(will|responsible|lead|build|design|manage|maintain|implement)\b/i.test(l)),
  );

  const keywords = extractKeywords(sanitized, sections);

  const result: ParsedJdContentDto = {
    jobTitle,
    company,
    experienceLevel,
    roleType,
    keywords,
    requirements,
    responsibilities,
  };

  return parsedJdContentSchema.parse(result);
}
