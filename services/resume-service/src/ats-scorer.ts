import type { ParsedResumeContentDto } from "./contracts.js";
import {
  type AtsBreakdownDto,
  type ParsedJdContentDto,
  atsBreakdownSchema,
} from "./jd-contracts.js";

/**
 * Normalizes string for keyword matching.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+#.\s]/g, " ");
}

/**
 * Checks if a keyword is present in text using word boundaries where appropriate.
 */
function containsKeyword(fullText: string, keyword: string): boolean {
  const normText = normalizeText(fullText);
  const normKw = normalizeText(keyword).trim();
  if (!normKw) return false;

  // Exact phrase match or boundary match
  const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i");
  return regex.test(normText) || normText.includes(normKw);
}

/**
 * Computes ATS score and breakdown matching the D09 five-component rubric.
 */
export function computeAtsScore(
  resume: ParsedResumeContentDto,
  jd: ParsedJdContentDto,
): AtsBreakdownDto {
  // 1. Gather all resume text
  const textParts: string[] = [];
  const directSkills: Set<string> = new Set();
  let totalBullets = 0;
  let quantBullets = 0;
  let wellSizedBullets = 0;

  if (resume.rawText) {
    textParts.push(resume.rawText);
  }

  if (resume.header.fullName) textParts.push(resume.header.fullName);
  if (resume.header.headline) textParts.push(resume.header.headline);
  if (resume.header.city) textParts.push(resume.header.city);
  if (resume.header.state) textParts.push(resume.header.state);

  let hasSummary = false;
  let hasExperience = false;
  let hasSkillsOrEducation = false;
  let hasSeniorTitle = false;

  for (const sec of resume.sections) {
    if (sec.kind === "summary" && sec.summary.trim().length > 10) {
      hasSummary = true;
      textParts.push(sec.summary);
    }

    if (sec.kind === "skills") {
      if (sec.groups.length > 0 || sec.entries.length > 0) {
        hasSkillsOrEducation = true;
      }
      for (const group of sec.groups) {
        for (const item of group.items) {
          if (item.text) {
            directSkills.add(item.text.toLowerCase());
            textParts.push(item.text);
          }
        }
      }
      for (const entry of sec.entries) {
        if (typeof entry["name"] === "string") {
          directSkills.add(entry["name"].toLowerCase());
          textParts.push(entry["name"]);
        }
      }
    }

    if (sec.kind === "education") {
      if (sec.entries.length > 0) {
        hasSkillsOrEducation = true;
      }
      for (const entry of sec.entries) {
        if (typeof entry["institution"] === "string") textParts.push(entry["institution"]);
        if (typeof entry["degree"] === "string") textParts.push(entry["degree"]);
        if (typeof entry["fieldOfStudy"] === "string") textParts.push(entry["fieldOfStudy"]);
      }
    }

    if (sec.kind === "projects") {
      for (const entry of sec.entries) {
        if (typeof entry["title"] === "string") textParts.push(entry["title"]);
        if (typeof entry["description"] === "string") textParts.push(entry["description"]);
        if (typeof entry["technologies"] === "string") {
          textParts.push(entry["technologies"]);
          for (const t of entry["technologies"].split(/[,/]/)) {
            const cleanT = t.trim();
            if (cleanT) directSkills.add(cleanT.toLowerCase());
          }
        }
        const bullets = Array.isArray(entry["bullets"]) ? entry["bullets"] : [];
        for (const b of bullets) {
          const text = typeof b === "string" ? b : typeof (b as { text: unknown }).text === "string" ? (b as { text: string }).text : "";
          if (text) textParts.push(text);
        }
      }
    }

    if (sec.kind === "experience") {
      if (sec.entries.length > 0) {
        hasExperience = true;
      }
      for (const entry of sec.entries) {
        if (typeof entry["title"] === "string") {
          textParts.push(entry["title"]);
          if (/\b(senior|sr\.?|lead|principal|staff|manager|head|director)\b/i.test(entry["title"])) {
            hasSeniorTitle = true;
          }
        }
        if (typeof entry["company"] === "string") textParts.push(entry["company"]);
        if (typeof entry["description"] === "string") textParts.push(entry["description"]);

        const bullets = Array.isArray(entry["bullets"]) ? entry["bullets"] : [];
        for (const b of bullets) {
          const bp = typeof b === "string" ? b : typeof (b as { text: unknown }).text === "string" ? (b as { text: string }).text : "";
          if (bp) {
            totalBullets++;
            textParts.push(bp);
            if (/\b(\d+%|\$\d+|\d+\s*x|\d+\s*(?:users|clients|ms|percent))\b/i.test(bp)) {
              quantBullets++;
            }
            if (bp.length >= 30 && bp.length <= 250) {
              wellSizedBullets++;
            }
          }
        }
      }
    }

    if (sec.kind === "certifications") {
      for (const entry of sec.entries) {
        if (typeof entry["title"] === "string") textParts.push(entry["title"]);
        if (typeof entry["issuer"] === "string") textParts.push(entry["issuer"]);
        const bullets = Array.isArray(entry["bullets"]) ? entry["bullets"] : [];
        for (const b of bullets) {
          const text = typeof b === "string" ? b : typeof (b as { text: unknown }).text === "string" ? (b as { text: string }).text : "";
          if (text) textParts.push(text);
        }
      }
    }
  }

  const allResumeText = textParts.join(" ");

  // 2. Component 1: Required Keyword Coverage (Weight 30%)
  const requiredKeywords = jd.keywords.filter((k) => k.required);
  const keywordTargetList = requiredKeywords.length > 0 ? requiredKeywords : jd.keywords;

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const kw of keywordTargetList) {
    if (containsKeyword(allResumeText, kw.name)) {
      matchedKeywords.push(kw.name);
    } else {
      missingKeywords.push(kw.name);
    }
  }

  const keywordScore = keywordTargetList.length > 0
    ? Math.round((matchedKeywords.length / keywordTargetList.length) * 100)
    : 100;

  // 3. Component 2: Experience & Responsibility Relevance (Weight 25%)
  let expScore: number;
  let feedback: string;

  const jdLevel = jd.experienceLevel || "unknown";
  if (jdLevel === "senior" || jdLevel === "lead" || jdLevel === "executive") {
    if (hasSeniorTitle) {
      expScore = 95;
      feedback = "Demonstrated senior-level leadership and tenure aligns with target seniority.";
    } else if (hasExperience) {
      expScore = 70;
      feedback = "Consider emphasizing leadership, architectural decisions, and senior scope in your experience.";
    } else {
      expScore = 45;
      feedback = "Role requires senior-level experience; add relevant industry experience.";
    }
  } else if (jdLevel === "entry") {
    expScore = hasExperience || hasSkillsOrEducation ? 95 : 70;
    feedback = "Background meets foundational entry-level requirements.";
  } else {
    expScore = hasExperience ? 90 : 65;
    feedback = "Solid general experience coverage for target position.";
  }

  // Check responsibilities overlap
  if (jd.responsibilities.length > 0) {
    let matchedRespWords = 0;
    for (const r of jd.responsibilities) {
      const words = r.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
      const matched = words.some((w) => allResumeText.toLowerCase().includes(w));
      if (matched) matchedRespWords++;
    }
    const respRatio = matchedRespWords / jd.responsibilities.length;
    expScore = Math.round((expScore * 0.7) + (respRatio * 100 * 0.3));
  }

  // 4. Component 3: Skills Alignment (Weight 20%)
  const techKeywords = jd.keywords.filter(
    (k) => k.category === "technical" || k.category === "tools" || k.category === "domain",
  );
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const sk of techKeywords) {
    const isDirectSkill = directSkills.has(sk.name.toLowerCase());
    const isInText = containsKeyword(allResumeText, sk.name);
    if (isDirectSkill || isInText) {
      matchedSkills.push(sk.name);
    } else {
      missingSkills.push(sk.name);
    }
  }

  const skillsScore = techKeywords.length > 0
    ? Math.round((matchedSkills.length / techKeywords.length) * 100)
    : 100;

  // 5. Component 4: Completeness and Structure (Weight 15%)
  let completenessScore = 0;
  if (resume.header.fullName && (resume.header.email || resume.header.phone || resume.sampleContact.email)) {
    completenessScore += 25;
  }
  if (hasSummary) completenessScore += 25;
  if (hasExperience) completenessScore += 25;
  if (hasSkillsOrEducation) completenessScore += 25;

  // 6. Component 5: Readability and Formatting (Weight 10%)
  let readabilityScore: number;
  if (totalBullets > 0) {
    const ratio = wellSizedBullets / totalBullets;
    readabilityScore = Math.max(50, Math.round(ratio * 100));
  } else {
    readabilityScore = 70;
  }

  // 7. Overall Weighted Score
  const rawOverall =
    keywordScore * 0.30 +
    expScore * 0.25 +
    skillsScore * 0.20 +
    completenessScore * 0.15 +
    readabilityScore * 0.10;

  const overallScore = Math.min(100, Math.max(0, Math.round(rawOverall)));

  // 8. Actionable Recommendations
  const recommendations: string[] = [];

  if (missingKeywords.length > 0) {
    recommendations.push(
      `Incorporate missing required keywords: ${missingKeywords.slice(0, 4).join(", ")} into your experience bullets or summary.`,
    );
  }

  if (missingSkills.length > 0) {
    recommendations.push(
      `Add target technical skills: ${missingSkills.slice(0, 4).join(", ")} to your skills section.`,
    );
  }

  if (!hasSummary) {
    recommendations.push(
      `Add a focused professional summary highlighting your fit for ${jd.jobTitle} at ${jd.company}.`,
    );
  }

  if (totalBullets > 0 && quantBullets < Math.ceil(totalBullets * 0.3)) {
    recommendations.push(
      "Quantify your accomplishments with measurable metrics (e.g., percentages, scale, performance improvements, revenue).",
    );
  }

  if (expScore < 70) {
    recommendations.push(feedback);
  }

  if (recommendations.length === 0) {
    recommendations.push("Resume demonstrates strong alignment with job description requirements.");
  }

  const breakdown: AtsBreakdownDto = {
    overallScore,
    rubricVersion: "1.0.0",
    keywordMatch: {
      matched: matchedKeywords,
      missing: missingKeywords,
      score: keywordScore,
    },
    experienceRelevance: {
      score: expScore,
      feedback,
    },
    skillsCoverage: {
      matched: matchedSkills,
      missing: missingSkills,
      score: skillsScore,
    },
    completenessScore,
    readabilityScore,
    recommendations,
  };

  return atsBreakdownSchema.parse(breakdown);
}
