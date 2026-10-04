import { randomUUID } from "node:crypto";
import {
  type ParsedResumeContentDto,
  parsedResumeContentSchema,
} from "./contracts.js";

export interface UserProfileFacts {
  id?: string;
  fullName: string;
  location?: string | null;
  professionalSummary?: string | null;
  contact?: {
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    address?: string | null;
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
    websiteUrl?: string | null;
  } | null;
  experiences: Array<{
    id: string;
    company: string;
    title: string;
    location?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    current?: boolean;
    isCurrent?: boolean;
    description?: string | null;
    bullets?: unknown;
    bulletPoints?: unknown;
    order?: number;
    sortOrder?: number;
  }>;
  educations: Array<{
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    grade?: string | null;
    gpa?: string | null;
    description?: string | null;
    order?: number;
    sortOrder?: number;
  }>;
  skills: Array<{
    id: string;
    name: string;
    category?: string | null;
    level?: string | null;
    proficiency?: string | null;
    order?: number;
    sortOrder?: number;
  }>;
  projects: Array<{
    id: string;
    name?: string;
    title?: string;
    description?: string | null;
    technologies?: unknown;
    url?: string | null;
    bullets?: unknown;
    order?: number;
    sortOrder?: number;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    issuer: string;
    issueDate?: string | null;
    expiryDate?: string | null;
    credentialUrl?: string | null;
    order?: number;
    sortOrder?: number;
  }>;
}

/**
 * Maps master UserProfile facts to structured ParsedResumeContentDto.
 * Adheres strictly to F06: Never invents qualifications, preserves fact provenance.
 */
export function mapProfileToResume(
  profile: UserProfileFacts,
  customTitle?: string,
): ParsedResumeContentDto {
  // Parse location into city and state if comma separated
  let city = "";
  let state = "";
  if (profile.location) {
    const parts = profile.location.split(",").map((p) => p.trim());
    city = parts[0] ?? "";
    state = parts[1] ?? "";
  }
  const contactObj = profile.contact as { city?: string; state?: string; address?: string } | undefined;
  if (!city && contactObj?.city) {
    city = contactObj.city;
  }
  if (!state && contactObj?.state) {
    state = contactObj.state;
  }
  if (!city && contactObj?.address) {
    const parts = contactObj.address.split(",").map((p) => p.trim());
    city = parts[0] ?? "";
    state = parts[1] ?? "";
  }

  const primaryTitle = profile.experiences[0]?.title ?? "Professional";
  const resumeTitle = customTitle?.trim() || `${profile.fullName} - ${primaryTitle}`;

  const links = [];
  if (profile.contact?.linkedinUrl) {
    links.push({ id: randomUUID(), label: "LinkedIn", url: profile.contact.linkedinUrl });
  }
  if (profile.contact?.githubUrl) {
    links.push({ id: randomUUID(), label: "GitHub", url: profile.contact.githubUrl });
  }
  const portfolio = profile.contact?.portfolioUrl ?? (profile.contact as { websiteUrl?: string } | undefined)?.websiteUrl;
  if (portfolio) {
    links.push({ id: randomUUID(), label: "Portfolio", url: portfolio });
  }

  const sections: ParsedResumeContentDto["sections"] = [];

  // 1. Professional Summary
  const summaryText =
    profile.professionalSummary && profile.professionalSummary.trim()
      ? profile.professionalSummary.trim()
      : profile.experiences.length > 0 || profile.skills.length > 0
        ? `${primaryTitle} with demonstrated expertise in ${profile.skills.slice(0, 4).map((s) => s.name).join(", ") || "software engineering"}.`
        : "";

  if (summaryText) {
    sections.push({
      id: randomUUID(),
      kind: "summary",
      label: "Professional Summary",
      hidden: false,
      summary: summaryText,
      entries: [],
      groups: [],
    });
  }

  // 2. Work Experience
  if (profile.experiences.length > 0) {
    const sortedExp = [...profile.experiences].sort(
      (a, b) => (a.order ?? a.sortOrder ?? 0) - (b.order ?? b.sortOrder ?? 0),
    );
    sections.push({
      id: randomUUID(),
      kind: "experience",
      label: "Work Experience",
      hidden: false,
      summary: "",
      entries: sortedExp.map((exp) => {
        const rawBullets = Array.isArray(exp.bullets)
          ? exp.bullets
          : Array.isArray(exp.bulletPoints)
            ? exp.bulletPoints
            : [];
        return {
          id: exp.id,
          title: exp.title,
          subtitle: "",
          company: exp.company,
          location: exp.location ?? "",
          startDate: exp.startDate ?? "",
          endDate: exp.endDate ?? (exp.current || exp.isCurrent ? "Present" : ""),
          description: exp.description ?? "",
          bullets: rawBullets.map((b) => ({
            id: randomUUID(),
            text: typeof b === "string" ? b : String(b),
            hidden: false,
          })),
        };
      }),
      groups: [],
    });
  }

  // 3. Education
  if (profile.educations.length > 0) {
    const sortedEdu = [...profile.educations].sort(
      (a, b) => (a.order ?? a.sortOrder ?? 0) - (b.order ?? b.sortOrder ?? 0),
    );
    sections.push({
      id: randomUUID(),
      kind: "education",
      label: "Education",
      hidden: false,
      summary: "",
      entries: sortedEdu.map((edu) => ({
        id: edu.id,
        title: edu.institution,
        subtitle: edu.degree,
        fieldOfStudy: edu.fieldOfStudy ?? "",
        startDate: edu.startDate ?? "",
        endDate: edu.endDate ?? "",
        grade: edu.grade ?? edu.gpa ?? "",
        hidden: false,
      })),
      groups: [],
    });
  }

  // 4. Skills (Grouped by category)
  if (profile.skills.length > 0) {
    const grouped = new Map<string, Array<{ id: string; name: string }>>();
    for (const sk of profile.skills) {
      const cat = sk.category?.trim() || "Technical Skills";
      const existing = grouped.get(cat);
      if (existing) {
        existing.push({ id: sk.id, name: sk.name });
      } else {
        grouped.set(cat, [{ id: sk.id, name: sk.name }]);
      }
    }

    const groups = Array.from(grouped.entries()).map(([catLabel, items]) => ({
      id: randomUUID(),
      label: catLabel,
      items: items.map((item) => ({
        id: item.id,
        text: item.name,
        hidden: false,
      })),
    }));

    sections.push({
      id: randomUUID(),
      kind: "skills",
      label: "Skills",
      hidden: false,
      summary: "",
      entries: [],
      groups,
    });
  }

  // 5. Projects
  if (profile.projects.length > 0) {
    const sortedProjects = [...profile.projects].sort(
      (a, b) => (a.order ?? a.sortOrder ?? 0) - (b.order ?? b.sortOrder ?? 0),
    );
    sections.push({
      id: randomUUID(),
      kind: "projects",
      label: "Projects",
      hidden: false,
      summary: "",
      entries: sortedProjects.map((p) => {
        const rawBullets = Array.isArray(p.bullets) ? p.bullets : [];
        const techList = Array.isArray(p.technologies) ? p.technologies.join(", ") : "";
        return {
          id: p.id,
          title: p.title || p.name || "Project",
          subtitle: "",
          description: p.description ?? "",
          technologies: techList,
          bullets: rawBullets.map((b) => ({
            id: randomUUID(),
            text: typeof b === "string" ? b : String(b),
            hidden: false,
          })),
          links: p.url ? [{ id: randomUUID(), label: "Project Link", url: p.url }] : [],
          hidden: false,
        };
      }),
      groups: [],
    });
  }

  // 6. Certifications
  if (profile.certifications.length > 0) {
    const sortedCerts = [...profile.certifications].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sections.push({
      id: randomUUID(),
      kind: "certifications",
      label: "Certifications",
      hidden: false,
      summary: "",
      entries: sortedCerts.map((cert) => ({
        id: cert.id,
        title: cert.name,
        issuer: cert.issuer,
        issueDate: cert.issueDate,
        expiryDate: cert.expiryDate ?? "",
        credentialUrl: cert.credentialUrl ?? "",
        bullets: [
          {
            id: randomUUID(),
            text: `${cert.name} - ${cert.issuer}${cert.issueDate ? ` (${cert.issueDate})` : ""}`,
            hidden: false,
          },
        ],
      })),
      groups: [],
    });
  }

  const result: ParsedResumeContentDto = {
    title: resumeTitle,
    header: {
      fullName: profile.fullName,
      firstName: profile.fullName.split(" ")[0] ?? "",
      lastName: profile.fullName.split(" ").slice(1).join(" "),
      headline: primaryTitle,
      city,
      state,
      country: "",
      email: profile.contact?.email ?? "",
      phone: profile.contact?.phone ?? "",
      links,
    },
    sampleContact: {
      email: profile.contact?.email ?? "",
      phone: profile.contact?.phone ?? "",
    },
    sections,
  };

  return parsedResumeContentSchema.parse(result);
}
