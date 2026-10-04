import type { ParsedResumeContentDto } from "./contracts.js";
import type { ParsedJdContentDto, ParsedKeywordDto } from "./jd-contracts.js";
import type {
  GapAnalysisResultDto,
  GapMatchedItemDto,
  GapSupportedMissingItemDto,
  GapUnsupportedMissingItemDto,
  GapMatchType,
} from "./gap-contracts.js";

export interface MasterProfileExperienceFact {
  readonly id: string;
  readonly company: string;
  readonly title: string;
  readonly position?: string;
  readonly description?: string | null;
  readonly bulletPoints: readonly string[];
}

export interface MasterProfileEducationFact {
  readonly id: string;
  readonly institution: string;
  readonly degree?: string | null;
  readonly fieldOfStudy?: string | null;
  readonly description?: string | null;
}

export interface MasterProfileSkillFact {
  readonly id: string;
  readonly name: string;
  readonly category?: string | null;
  readonly proficiency?: string | null;
}

export interface MasterProfileProjectFact {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly technologies: readonly string[];
}

export interface MasterProfileCertificationFact {
  readonly id: string;
  readonly name: string;
  readonly issuer: string;
}

export interface MasterProfileFacts {
  readonly id: string;
  readonly fullName?: string;
  readonly location?: string | null;
  readonly professionalSummary?: string | null;
  readonly revision: number;
  readonly experiences: readonly MasterProfileExperienceFact[];
  readonly educations: readonly MasterProfileEducationFact[];
  readonly skills: readonly MasterProfileSkillFact[];
  readonly projects: readonly MasterProfileProjectFact[];
  readonly certifications: readonly MasterProfileCertificationFact[];
}

export interface GapAnalysisMetadata {
  readonly resumeId: string;
  readonly resumeTitle: string;
  readonly resumeVersion: number;
  readonly profileRevision: number;
  readonly jdHistoryId: string | null;
  readonly jobTitle: string | null;
  readonly company: string | null;
}

/**
 * Common technical and professional synonyms / aliases.
 */
const SYNONYM_MAP: Record<string, readonly string[]> = {
  typescript: ["ts"],
  ts: ["typescript"],
  javascript: ["js"],
  js: ["javascript"],
  python: ["py"],
  py: ["python"],
  postgresql: ["postgres", "pgsql"],
  postgres: ["postgresql", "pgsql"],
  kubernetes: ["k8s"],
  k8s: ["kubernetes"],
  react: ["react.js", "reactjs"],
  reactjs: ["react", "react.js"],
  "react.js": ["react", "reactjs"],
  node: ["node.js", "nodejs"],
  nodejs: ["node", "node.js"],
  "node.js": ["node", "nodejs"],
  vue: ["vue.js", "vuejs"],
  golang: ["go"],
  go: ["golang"],
  mongodb: ["mongo"],
  mongo: ["mongodb"],
  docker: ["containers", "containerization"],
  containers: ["docker", "containerization"],
  aws: ["amazon web services"],
  "amazon web services": ["aws"],
  gcp: ["google cloud", "google cloud platform"],
  "google cloud": ["gcp", "google cloud platform"],
  azure: ["microsoft azure"],
  "microsoft azure": ["azure"],
  graphql: ["gql"],
  gql: ["graphql"],
  terraform: ["tf", "iac", "infrastructure as code"],
  tf: ["terraform"],
  "ci/cd": ["cicd", "continuous integration", "continuous deployment"],
  cicd: ["ci/cd", "continuous integration", "continuous deployment"],
  rest: ["restful", "rest api", "restful api"],
  restful: ["rest", "rest api"],
  redis: ["caching", "in-memory cache"],
  kafka: ["apache kafka", "event streaming"],
  microservices: ["distributed systems"],
  testing: ["unit testing", "integration testing", "tdd", "jest", "vitest"],
  ai: ["artificial intelligence", "machine learning"],
  "artificial intelligence": ["ai", "machine learning"],
  ml: ["machine learning", "ai"],
  "machine learning": ["ml", "ai"],
};

function normalize(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ").trim();
}

function containsExact(fullText: string, term: string): boolean {
  const normText = normalize(fullText);
  const normTerm = normalize(term);
  if (!normTerm || !normText) return false;

  const escaped = normTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i");
  return regex.test(normText) || normText.includes(` ${normTerm} `);
}

function getSynonyms(term: string): readonly string[] {
  const norm = normalize(term);
  return SYNONYM_MAP[norm] ?? [];
}

interface MatchCandidate {
  readonly matchType: GapMatchType;
  readonly matchedText: string;
  readonly section:
    | "summary"
    | "experience"
    | "skills"
    | "projects"
    | "education"
    | "certifications";
  readonly entryTitle?: string;
  readonly excerpt: string;
}

/**
 * Searches the resume content for an exact or synonym match of the given keyword.
 */
function findInResume(
  resume: ParsedResumeContentDto,
  keyword: string,
): MatchCandidate | null {
  const synonyms = getSynonyms(keyword);

  for (const sec of resume.sections) {
    if (sec.kind === "summary" && sec.summary) {
      if (containsExact(sec.summary, keyword)) {
        return {
          matchType: "exact",
          matchedText: keyword,
          section: "summary",
          excerpt: sec.summary.slice(0, 140),
        };
      }
      for (const syn of synonyms) {
        if (containsExact(sec.summary, syn)) {
          return {
            matchType: "synonym",
            matchedText: syn,
            section: "summary",
            excerpt: sec.summary.slice(0, 140),
          };
        }
      }
    }

    if (sec.kind === "skills") {
      for (const group of sec.groups) {
        for (const item of group.items) {
          if (item.text && containsExact(item.text, keyword)) {
            return {
              matchType: "exact",
              matchedText: item.text,
              section: "skills",
              entryTitle: group.label,
              excerpt: `Skill "${item.text}" in ${group.label}`,
            };
          }
          for (const syn of synonyms) {
            if (item.text && containsExact(item.text, syn)) {
              return {
                matchType: "synonym",
                matchedText: syn,
                section: "skills",
                entryTitle: group.label,
                excerpt: `Skill alias "${syn}" in ${group.label}`,
              };
            }
          }
        }
      }
      for (const entry of sec.entries) {
        const name = typeof entry["name"] === "string" ? entry["name"] : "";
        if (name && containsExact(name, keyword)) {
          return {
            matchType: "exact",
            matchedText: name,
            section: "skills",
            excerpt: `Skill entry "${name}"`,
          };
        }
        for (const syn of synonyms) {
          if (name && containsExact(name, syn)) {
            return {
              matchType: "synonym",
              matchedText: syn,
              section: "skills",
              excerpt: `Skill alias "${syn}"`,
            };
          }
        }
      }
    }

    if (sec.kind === "experience") {
      for (const entry of sec.entries) {
        const title = typeof entry["title"] === "string" ? entry["title"] : "";
        const company =
          typeof entry["company"] === "string"
            ? entry["company"]
            : typeof entry["subtitle"] === "string"
              ? entry["subtitle"]
              : "";
        const desc = typeof entry["description"] === "string" ? entry["description"] : "";
        const rawBullets: unknown[] = Array.isArray(entry["bulletPoints"])
          ? (entry["bulletPoints"] as unknown[])
          : Array.isArray(entry["bullets"])
            ? (entry["bullets"] as unknown[])
            : [];
        const bullets: string[] = rawBullets
          .map((b) =>
            typeof b === "string"
              ? b
              : typeof b === "object" && b !== null && "text" in b
                ? String(b.text)
                : "",
          )
          .filter(Boolean);

        // Check title, company, desc
        const entryHeader = `${title} at ${company}`.trim();
        if (title && containsExact(title, keyword)) {
          return {
            matchType: "exact",
            matchedText: keyword,
            section: "experience",
            entryTitle: entryHeader,
            excerpt: `Job title "${title}" at ${company}`,
          };
        }
        if (desc && containsExact(desc, keyword)) {
          return {
            matchType: "exact",
            matchedText: keyword,
            section: "experience",
            entryTitle: entryHeader,
            excerpt: desc.slice(0, 140),
          };
        }

        // Check bullets
        for (const bullet of bullets) {
          if (containsExact(bullet, keyword)) {
            return {
              matchType: "exact",
              matchedText: keyword,
              section: "experience",
              entryTitle: entryHeader,
              excerpt: bullet.slice(0, 140),
            };
          }
          for (const syn of synonyms) {
            if (containsExact(bullet, syn)) {
              return {
                matchType: "synonym",
                matchedText: syn,
                section: "experience",
                entryTitle: entryHeader,
                excerpt: bullet.slice(0, 140),
              };
            }
          }
        }
      }
    }

    if (sec.kind === "projects") {
      for (const entry of sec.entries) {
        const title = typeof entry["title"] === "string" ? entry["title"] : "";
        const desc = typeof entry["description"] === "string" ? entry["description"] : "";
        const techs = typeof entry["technologies"] === "string" ? entry["technologies"] : "";

        if (title && containsExact(title, keyword)) {
          return {
            matchType: "exact",
            matchedText: keyword,
            section: "projects",
            entryTitle: title,
            excerpt: `Project "${title}"`,
          };
        }
        if (techs && containsExact(techs, keyword)) {
          return {
            matchType: "exact",
            matchedText: keyword,
            section: "projects",
            entryTitle: title,
            excerpt: `Project technologies: ${techs}`,
          };
        }
        if (desc && containsExact(desc, keyword)) {
          return {
            matchType: "exact",
            matchedText: keyword,
            section: "projects",
            entryTitle: title,
            excerpt: desc.slice(0, 140),
          };
        }
        for (const syn of synonyms) {
          if (
            (techs && containsExact(techs, syn)) ||
            (desc && containsExact(desc, syn))
          ) {
            return {
              matchType: "synonym",
              matchedText: syn,
              section: "projects",
              entryTitle: title,
              excerpt: `Project "${title}" references "${syn}"`,
            };
          }
        }
      }
    }

    if (sec.kind === "education") {
      for (const entry of sec.entries) {
        const degree = typeof entry["degree"] === "string" ? entry["degree"] : "";
        const field = typeof entry["fieldOfStudy"] === "string" ? entry["fieldOfStudy"] : "";
        const inst = typeof entry["institution"] === "string" ? entry["institution"] : "";

        if (
          containsExact(degree, keyword) ||
          containsExact(field, keyword) ||
          containsExact(inst, keyword)
        ) {
          return {
            matchType: "exact",
            matchedText: keyword,
            section: "education",
            entryTitle: `${degree} in ${field} - ${inst}`.trim(),
            excerpt: `${degree} in ${field} at ${inst}`,
          };
        }
      }
    }

    if (sec.kind === "certifications") {
      for (const entry of sec.entries) {
        const name = typeof entry["name"] === "string" ? entry["name"] : "";
        const issuer = typeof entry["issuer"] === "string" ? entry["issuer"] : "";

        if (containsExact(name, keyword) || containsExact(issuer, keyword)) {
          return {
            matchType: "exact",
            matchedText: keyword,
            section: "certifications",
            entryTitle: name,
            excerpt: `Certification "${name}" issued by ${issuer}`,
          };
        }
      }
    }
  }

  // Fallback: check rawText if available
  if (resume.rawText && containsExact(resume.rawText, keyword)) {
    return {
      matchType: "exact",
      matchedText: keyword,
      section: "experience",
      excerpt: `Mentioned in resume body text`,
    };
  }

  return null;
}

interface ProfileSupportCandidate {
  readonly supportingSourceSection:
    | "skills"
    | "experience"
    | "projects"
    | "education"
    | "certifications"
    | "profile";
  readonly supportingEvidence: string;
  readonly suggestedTargetSection: "skills" | "experience" | "summary" | "projects";
  readonly suggestedAction: string;
}

/**
 * Checks if a missing keyword is supported by verified facts in the user's master profile.
 * Strict invariant: UserContact is NEVER checked or leaked.
 */
function findInMasterProfile(
  profile: MasterProfileFacts,
  keyword: string,
): ProfileSupportCandidate | null {
  const synonyms = getSynonyms(keyword);

  // 1. Check master skills
  for (const sk of profile.skills) {
    if (containsExact(sk.name, keyword)) {
      const profNote = sk.proficiency ? ` (${sk.proficiency})` : "";
      return {
        supportingSourceSection: "skills",
        supportingEvidence: `Skill "${sk.name}"${profNote} recorded in master profile`,
        suggestedTargetSection: "skills",
        suggestedAction: `Add "${sk.name}" from your master profile to this resume's Skills section.`,
      };
    }
    for (const syn of synonyms) {
      if (containsExact(sk.name, syn)) {
        return {
          supportingSourceSection: "skills",
          supportingEvidence: `Skill "${sk.name}" (matches "${syn}") in master profile`,
          suggestedTargetSection: "skills",
          suggestedAction: `Include "${keyword}" (${sk.name}) in your resume's Skills list.`,
        };
      }
    }
  }

  // 2. Check master experiences
  for (const exp of profile.experiences) {
    const roleTitle = exp.title || exp.position || "";
    const roleAtCo = roleTitle ? `${roleTitle} at ${exp.company}` : exp.company;
    if (roleTitle && containsExact(roleTitle, keyword)) {
      return {
        supportingSourceSection: "experience",
        supportingEvidence: `Held role as ${roleTitle} at ${exp.company}`,
        suggestedTargetSection: "experience",
        suggestedAction: `Emphasize your role as ${roleTitle} at ${exp.company} in this resume.`,
      };
    }
    if (exp.description && containsExact(exp.description, keyword)) {
      return {
        supportingSourceSection: "experience",
        supportingEvidence: `Experience description for ${roleAtCo}: "${exp.description.slice(0, 100)}"`,
        suggestedTargetSection: "experience",
        suggestedAction: `Highlight your work with "${keyword}" from ${exp.company}.`,
      };
    }
    for (const bullet of exp.bulletPoints) {
      if (containsExact(bullet, keyword)) {
        return {
          supportingSourceSection: "experience",
          supportingEvidence: `${roleAtCo}: "${bullet.slice(0, 120)}"`,
          suggestedTargetSection: "experience",
          suggestedAction: `Add the bullet point regarding "${keyword}" from ${exp.company} to this resume.`,
        };
      }
      for (const syn of synonyms) {
        if (containsExact(bullet, syn)) {
          return {
            supportingSourceSection: "experience",
            supportingEvidence: `${roleAtCo}: "${bullet.slice(0, 120)}" (contains "${syn}")`,
            suggestedTargetSection: "experience",
            suggestedAction: `Incorporate evidence of "${keyword}" from your achievements at ${exp.company}.`,
          };
        }
      }
    }
  }

  // 3. Check master projects
  for (const proj of profile.projects) {
    if (containsExact(proj.name, keyword)) {
      return {
        supportingSourceSection: "projects",
        supportingEvidence: `Project "${proj.name}" in master profile`,
        suggestedTargetSection: "projects",
        suggestedAction: `Add project "${proj.name}" to your resume's Projects section.`,
      };
    }
    for (const tech of proj.technologies) {
      if (containsExact(tech, keyword)) {
        return {
          supportingSourceSection: "projects",
          supportingEvidence: `Technology "${tech}" used in Project "${proj.name}"`,
          suggestedTargetSection: "projects",
          suggestedAction: `Include project "${proj.name}" demonstrating hands-on "${keyword}" experience.`,
        };
      }
      for (const syn of synonyms) {
        if (containsExact(tech, syn)) {
          return {
            supportingSourceSection: "projects",
            supportingEvidence: `Project "${proj.name}" utilized "${tech}" (alias of "${keyword}")`,
            suggestedTargetSection: "projects",
            suggestedAction: `Add project "${proj.name}" to highlight "${keyword}" skills.`,
          };
        }
      }
    }
    if (proj.description && containsExact(proj.description, keyword)) {
      return {
        supportingSourceSection: "projects",
        supportingEvidence: `Project "${proj.name}" description: "${proj.description.slice(0, 100)}"`,
        suggestedTargetSection: "projects",
        suggestedAction: `Include project "${proj.name}" highlighting "${keyword}".`,
      };
    }
  }

  // 4. Check master certifications
  for (const cert of profile.certifications) {
    if (containsExact(cert.name, keyword) || containsExact(cert.issuer, keyword)) {
      return {
        supportingSourceSection: "certifications",
        supportingEvidence: `Certification "${cert.name}" issued by ${cert.issuer}`,
        suggestedTargetSection: "skills",
        suggestedAction: `List your "${cert.name}" credential under Certifications or Skills.`,
      };
    }
  }

  // 5. Check master educations
  for (const edu of profile.educations) {
    const deg = edu.degree ?? "";
    const fld = edu.fieldOfStudy ?? "";
    if (containsExact(deg, keyword) || containsExact(fld, keyword)) {
      return {
        supportingSourceSection: "education",
        supportingEvidence: `${deg} in ${fld} from ${edu.institution}`,
        suggestedTargetSection: "summary",
        suggestedAction: `Reference your academic background in ${fld} in your summary.`,
      };
    }
  }

  // 6. Check summary / headline
  if (profile.professionalSummary && containsExact(profile.professionalSummary, keyword)) {
    return {
      supportingSourceSection: "profile",
      supportingEvidence: `Master profile summary mentions "${keyword}"`,
      suggestedTargetSection: "summary",
      suggestedAction: `Include your master profile summary statement regarding "${keyword}".`,
    };
  }

  return null;
}

/**
 * Performs keyword and skill gap analysis comparing a resume and job description,
 * grounded against master profile facts.
 */
export function analyzeKeywordGaps(
  resume: ParsedResumeContentDto,
  jd: ParsedJdContentDto,
  profile: MasterProfileFacts,
  metadata: GapAnalysisMetadata,
): GapAnalysisResultDto {
  const matched: GapMatchedItemDto[] = [];
  const supportedMissing: GapSupportedMissingItemDto[] = [];
  const unsupportedMissing: GapUnsupportedMissingItemDto[] = [];

  // Dedup keywords from JD by normalized name
  const seenKws = new Set<string>();
  const allKeywords: ParsedKeywordDto[] = [];

  for (const kw of jd.keywords) {
    const norm = normalize(kw.name);
    if (!norm || seenKws.has(norm)) continue;
    seenKws.add(norm);
    allKeywords.push(kw);
  }

  // If JD has no structured keywords, synthesize keywords from requirements
  if (allKeywords.length === 0 && jd.requirements.length > 0) {
    for (const req of jd.requirements) {
      const parts = req.split(/[,;:]|\band\b|\bwith\b|\bor\b/i);
      for (const p of parts) {
        const clean = p.trim();
        const norm = normalize(clean);
        if (clean.length >= 3 && clean.length <= 40 && !seenKws.has(norm)) {
          seenKws.add(norm);
          allKeywords.push({
            name: clean,
            category: "technical",
            required: true,
            evidence: req,
          });
        }
      }
    }
  }

  for (const kw of allKeywords) {
    const resumeMatch = findInResume(resume, kw.name);

    if (resumeMatch) {
      matched.push({
        keyword: kw.name,
        category: kw.category,
        required: kw.required,
        matchType: resumeMatch.matchType,
        matchedText: resumeMatch.matchedText,
        resumeSection: resumeMatch.section,
        resumeEntryTitle: resumeMatch.entryTitle,
        explanation: `Matches "${resumeMatch.matchedText}" found in resume ${resumeMatch.section}.`,
      });
      continue;
    }

    // Keyword missing from open resume: check master profile
    const profileSupport = findInMasterProfile(profile, kw.name);

    if (profileSupport) {
      supportedMissing.push({
        keyword: kw.name,
        category: kw.category,
        required: kw.required,
        supportingSourceSection: profileSupport.supportingSourceSection,
        supportingEvidence: profileSupport.supportingEvidence,
        profileRevision: profile.revision,
        suggestedTargetSection: profileSupport.suggestedTargetSection,
        suggestedAction: profileSupport.suggestedAction,
        explanation: `Supported in master profile ${profileSupport.supportingSourceSection}, but omitted from this resume.`,
      });
    } else {
      unsupportedMissing.push({
        keyword: kw.name,
        category: kw.category,
        required: kw.required,
        jdContext: kw.evidence || undefined,
        advice: `If you possess experience with "${kw.name}", add it to your Master Profile under Skills or Experience first.`,
        explanation: "Not found in this profile.",
      });
    }
  }

  const totalKeywordsCount =
    matched.length + supportedMissing.length + unsupportedMissing.length;
  const matchedCount = matched.length;
  const supportedMissingCount = supportedMissing.length;
  const unsupportedMissingCount = unsupportedMissing.length;
  const requiredMissingCount = [
    ...supportedMissing,
    ...unsupportedMissing,
  ].filter((item) => item.required).length;

  const matchPercentage =
    totalKeywordsCount === 0
      ? 100
      : Math.round((matchedCount / totalKeywordsCount) * 100);

  return {
    resumeId: metadata.resumeId,
    resumeTitle: metadata.resumeTitle,
    resumeVersion: metadata.resumeVersion,
    profileRevision: metadata.profileRevision,
    jdHistoryId: metadata.jdHistoryId,
    jobTitle: metadata.jobTitle,
    company: metadata.company,
    matchPercentage,
    totalKeywordsCount,
    matchedCount,
    supportedMissingCount,
    unsupportedMissingCount,
    requiredMissingCount,
    matched,
    supportedMissing,
    unsupportedMissing,
    model: "deterministic-hybrid-v1",
    semanticEngineStatus: "fallback_exact_synonyms",
    analyzedAt: new Date().toISOString(),
  };
}
