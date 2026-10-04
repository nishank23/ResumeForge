import test from "node:test";
import assert from "node:assert/strict";
import { mapProfileToResume } from "../dist/content-mapper.js";
import { generateSectionSuggestion } from "../dist/suggestion-engine.js";
import { parsedResumeContentSchema } from "../dist/contracts.js";

test("mapProfileToResume maps all profile facts to validated ParsedResumeContentDto", () => {
  const profile = {
    fullName: "Jane Doe",
    contact: {
      email: "jane.doe@example.com",
      phone: "+1-555-0199",
      city: "San Francisco",
      state: "CA",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      githubUrl: "https://github.com/janedoe",
      websiteUrl: "https://janedoe.dev",
    },
    experiences: [
      {
        id: "exp-1",
        title: "Senior Full Stack Engineer",
        company: "Acme Corp",
        location: "San Francisco, CA",
        startDate: "2021-01",
        endDate: "2024-03",
        isCurrent: false,
        bulletPoints: [
          "Led development of core checkout platform processing $50M annually.",
          "Designed reactive microservices reducing p99 latency by 45%.",
        ],
      },
    ],
    educations: [
      {
        id: "edu-1",
        institution: "University of California, Berkeley",
        degree: "Bachelor of Science",
        fieldOfStudy: "Computer Science",
        startDate: "2016-08",
        endDate: "2020-05",
        gpa: "3.9",
        description: "Focus on distributed systems and software architecture.",
      },
    ],
    skills: [
      { id: "sk-1", name: "TypeScript", category: "Languages", proficiency: "Expert" },
      { id: "sk-2", name: "Node.js", category: "Languages", proficiency: "Expert" },
      { id: "sk-3", name: "PostgreSQL", category: "Databases", proficiency: "Advanced" },
      { id: "sk-4", name: "Docker", category: "DevOps", proficiency: "Intermediate" },
    ],
    projects: [
      {
        id: "proj-1",
        name: "CloudMetrics",
        description: "Real-time telemetry observability platform built with Go and React.",
        url: "https://github.com/janedoe/cloudmetrics",
        technologies: ["Go", "React", "Prometheus"],
        startDate: "2023-01",
        endDate: "2023-06",
      },
    ],
    certifications: [
      {
        id: "cert-1",
        name: "AWS Certified Solutions Architect",
        issuer: "Amazon Web Services",
        issueDate: "2022-04",
        expiryDate: "2025-04",
        credentialUrl: "https://aws.amazon.com/verify/12345",
      },
    ],
  };

  const parsed = mapProfileToResume(profile, "Custom Targeted Resume");

  // Validate against parsedResumeContentSchema
  const validated = parsedResumeContentSchema.parse(parsed);
  assert.equal(validated.title, "Custom Targeted Resume");
  assert.equal(validated.header.fullName, "Jane Doe");
  assert.equal(validated.header.firstName, "Jane");
  assert.equal(validated.header.lastName, "Doe");
  assert.equal(validated.header.headline, "Senior Full Stack Engineer");
  assert.equal(validated.header.city, "San Francisco");
  assert.equal(validated.header.state, "CA");
  assert.equal(validated.header.email, "jane.doe@example.com");
  assert.equal(validated.header.links.length, 3);

  // Validate sections structure
  const summarySec = validated.sections.find((s) => s.kind === "summary");
  assert.ok(summarySec);
  assert.ok(summarySec.summary.includes("Senior Full Stack Engineer"));

  const expSec = validated.sections.find((s) => s.kind === "experience");
  assert.ok(expSec);
  assert.equal(expSec.entries.length, 1);
  assert.equal(expSec.entries[0].title, "Senior Full Stack Engineer");
  assert.equal(expSec.entries[0].bullets.length, 2);

  const eduSec = validated.sections.find((s) => s.kind === "education");
  assert.ok(eduSec);
  assert.equal(eduSec.entries.length, 1);
  assert.equal(eduSec.entries[0].title, "University of California, Berkeley");

  const skillSec = validated.sections.find((s) => s.kind === "skills");
  assert.ok(skillSec);
  assert.equal(skillSec.groups.length, 3); // Languages, Databases, DevOps

  const projSec = validated.sections.find((s) => s.kind === "projects");
  assert.ok(projSec);
  assert.equal(projSec.entries.length, 1);
  assert.equal(projSec.entries[0].title, "CloudMetrics");

  const certSec = validated.sections.find((s) => s.kind === "certifications");
  assert.ok(certSec);
  assert.equal(certSec.entries.length, 1);
  assert.equal(certSec.entries[0].title, "AWS Certified Solutions Architect");
});

test("generateSectionSuggestion improves impact with strong action verbs", () => {
  const result = generateSectionSuggestion({
    originalContent: "helped with migrating our database to postgres",
    action: "improve_impact",
    sectionKind: "experience",
  });

  assert.ok(result.suggestionId);
  assert.ok(
    result.suggestedContent.startsWith("Collaborated") ||
      result.suggestedContent.startsWith("Facilitated") ||
      result.suggestedContent.startsWith("Spearheaded"),
  );
  assert.ok(result.reasoning.includes("action verbs"));
});

test("generateSectionSuggestion quantifies achievements with measurable metrics", () => {
  const result = generateSectionSuggestion({
    originalContent: "Optimized distributed caching layer across service fleet",
    action: "quantify",
    sectionKind: "experience",
  });

  assert.ok(result.suggestedContent.includes("35%"));
  assert.ok(result.reasoning.includes("measurable performance metrics"));
});

test("generateSectionSuggestion tailors strictly to intersecting grounded skills without hallucination", () => {
  const result = generateSectionSuggestion({
    originalContent: "Full stack engineer delivering microservices",
    action: "tailor_to_jd",
    sectionKind: "summary",
    profileSkills: ["TypeScript", "PostgreSQL", "Docker", "Redis"],
    jdKeywords: ["TypeScript", "PostgreSQL", "Kubernetes", "GraphQL"], // Kubernetes & GraphQL not in profile!
  });

  // Only TypeScript & PostgreSQL are grounded; Kubernetes and GraphQL must NOT be included!
  assert.ok(result.suggestedContent.includes("TypeScript"));
  assert.ok(result.suggestedContent.includes("PostgreSQL"));
  assert.ok(!result.suggestedContent.includes("Kubernetes"));
  assert.ok(!result.suggestedContent.includes("GraphQL"));
  assert.deepEqual(result.groundedKeywords, ["TypeScript", "PostgreSQL"]);
});

test("generateSectionSuggestion shortens long sentences", () => {
  const longContent = "First sentence describing feature. Second sentence describing testing. Third sentence that is redundant and makes the bullet point too lengthy.";
  const result = generateSectionSuggestion({
    originalContent: longContent,
    action: "shorten",
    sectionKind: "experience",
  });

  assert.ok(result.suggestedContent.length < longContent.length);
  assert.ok(result.reasoning.includes("Condensed"));
});

test("generateSectionSuggestion rewrites conversational filler words", () => {
  const result = generateSectionSuggestion({
    originalContent: "Was responsible for the deployment in order to reduce downtime",
    action: "rewrite",
    sectionKind: "experience",
  });

  assert.ok(!result.suggestedContent.includes("in order to"));
  assert.ok(result.suggestedContent.includes("to"));
  assert.ok(result.suggestedContent.includes("led the deployment"));
});
