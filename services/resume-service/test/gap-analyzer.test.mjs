import test from "node:test";
import assert from "node:assert/strict";
import { analyzeKeywordGaps } from "../dist/gap-analyzer.js";

function createMockResume(overrides = {}) {
  return {
    header: {
      fullName: "Alice Developer",
      headline: "Senior Software Engineer",
      email: "alice@example.invalid",
      phone: "+1 555-0199",
      city: "San Francisco",
      state: "CA",
      links: [],
    },
    title: "Alice FullStack Resume",
    summary: "Experienced software engineer specializing in Node.js and TypeScript.",
    rawText: "Experienced software engineer specializing in Node.js and TypeScript.",
    sections: [
      {
        id: "sec-sum",
        kind: "summary",
        title: "Summary",
        summary: "Experienced software engineer specializing in Node.js and TypeScript.",
      },
      {
        id: "sec-skills",
        kind: "skills",
        title: "Skills",
        groups: [
          {
            id: "grp-1",
            label: "Languages & Frameworks",
            items: [
              { id: "s-1", text: "TypeScript", hidden: false },
              { id: "s-2", text: "Node.js", hidden: false },
              { id: "s-3", text: "React", hidden: false },
            ],
          },
        ],
        entries: [],
      },
      {
        id: "sec-exp",
        kind: "experience",
        title: "Experience",
        entries: [
          {
            id: "exp-1",
            title: "Senior Backend Developer",
            subtitle: "TechCorp",
            location: "San Francisco, CA",
            startDate: "2021-01",
            endDate: "Present",
            isCurrent: true,
            bullets: [
              {
                id: "b-1",
                text: "Architected scalable microservices using TypeScript and Docker.",
                hidden: false,
              },
            ],
            hidden: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createMockJD(overrides = {}) {
  return {
    jobTitle: "Senior Distributed Systems Engineer",
    company: "CloudNative Inc",
    experienceLevel: "senior",
    roleType: "full-time",
    keywords: [
      {
        name: "TypeScript",
        category: "technical",
        required: true,
        evidence: "Must have 5+ years TypeScript experience",
      },
      {
        name: "Kubernetes",
        category: "tools",
        required: true,
        evidence: "Extensive Kubernetes cluster operations required",
      },
      {
        name: "PostgreSQL",
        category: "technical",
        required: false,
        evidence: "Experience with PostgreSQL or relational databases",
      },
      {
        name: "Rust",
        category: "technical",
        required: false,
        evidence: "Familiarity with Rust is a plus",
      },
    ],
    requirements: ["5+ years TypeScript", "Kubernetes cluster administration"],
    responsibilities: ["Build distributed platforms"],
    ...overrides,
  };
}

function createMockMasterProfile(overrides = {}) {
  return {
    id: "prof-uuid-1",
    fullName: "Alice Developer",
    location: "San Francisco, CA",
    professionalSummary: "Full-stack engineer with deep expertise across backend systems.",
    revision: 3,
    experiences: [
      {
        id: "m-exp-1",
        company: "TechCorp",
        title: "Senior Backend Developer",
        bulletPoints: [
          "Architected scalable microservices using TypeScript and Docker.",
          "Managed production Kubernetes clusters (k8s) and helm charts across 3 regions.",
        ],
      },
    ],
    educations: [
      {
        id: "m-edu-1",
        institution: "University of California, Berkeley",
        degree: "Bachelor of Science",
        fieldOfStudy: "Computer Science",
      },
    ],
    skills: [
      {
        id: "m-sk-1",
        name: "TypeScript",
        category: "Languages",
        proficiency: "expert",
      },
      {
        id: "m-sk-2",
        name: "Node.js",
        category: "Frameworks",
        proficiency: "expert",
      },
      {
        id: "m-sk-3",
        name: "PostgreSQL",
        category: "Databases",
        proficiency: "advanced",
      },
      {
        id: "m-sk-4",
        name: "Docker",
        category: "DevOps",
        proficiency: "advanced",
      },
    ],
    projects: [
      {
        id: "m-proj-1",
        name: "Distributed Cache Service",
        description: "High-throughput in-memory cache",
        technologies: ["Go", "Redis", "Docker"],
      },
    ],
    certifications: [
      {
        id: "m-cert-1",
        name: "Certified Kubernetes Administrator",
        issuer: "Cloud Native Computing Foundation",
      },
    ],
    ...overrides,
  };
}

test("analyzeKeywordGaps correctly classifies matched, supported_missing, and unsupported_missing", () => {
  const resume = createMockResume();
  const jd = createMockJD();
  const profile = createMockMasterProfile();

  const metadata = {
    resumeId: "11111111-1111-4111-8111-111111111111",
    resumeTitle: "Alice FullStack Resume",
    resumeVersion: 1,
    profileRevision: 3,
    jdHistoryId: "22222222-2222-4222-8222-222222222222",
    jobTitle: "Senior Distributed Systems Engineer",
    company: "CloudNative Inc",
  };

  const result = analyzeKeywordGaps(resume, jd, profile, metadata);

  // 1. Matched: TypeScript (in Resume skills & summary)
  const tsMatch = result.matched.find((m) => m.keyword === "TypeScript");
  assert.ok(tsMatch, "TypeScript should be classified as matched");
  assert.equal(tsMatch.matchType, "exact");
  assert.equal(tsMatch.required, true);

  // 2. Supported missing: Kubernetes (omitted in resume, but present in master profile exp & certification)
  const k8sMissing = result.supportedMissing.find(
    (m) => m.keyword === "Kubernetes",
  );
  assert.ok(
    k8sMissing,
    "Kubernetes should be classified as supported_missing",
  );
  assert.equal(k8sMissing.required, true);
  assert.ok(
    k8sMissing.supportingEvidence.includes("Kubernetes") ||
      k8sMissing.supportingEvidence.includes("k8s"),
  );
  assert.equal(k8sMissing.profileRevision, 3);
  assert.ok(k8sMissing.suggestedAction.length > 0);

  // 3. Supported missing: PostgreSQL (omitted in resume, but present in master profile skills)
  const pgMissing = result.supportedMissing.find(
    (m) => m.keyword === "PostgreSQL",
  );
  assert.ok(
    pgMissing,
    "PostgreSQL should be classified as supported_missing",
  );
  assert.equal(pgMissing.supportingSourceSection, "skills");
  assert.equal(pgMissing.suggestedTargetSection, "skills");

  // 4. Unsupported missing: Rust (neither in resume nor in master profile)
  const rustMissing = result.unsupportedMissing.find(
    (m) => m.keyword === "Rust",
  );
  assert.ok(
    rustMissing,
    "Rust should be classified as unsupported_missing",
  );
  assert.equal(rustMissing.explanation, "Not found in this profile.");
  assert.ok(rustMissing.advice.includes("add it to your Master Profile"));

  // 5. Aggregate metrics
  assert.equal(result.totalKeywordsCount, 4);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.supportedMissingCount, 2);
  assert.equal(result.unsupportedMissingCount, 1);
  assert.equal(result.requiredMissingCount, 1); // Kubernetes is required
  assert.equal(result.matchPercentage, 25); // 1 out of 4 = 25%
  assert.equal(result.model, "deterministic-hybrid-v1");
  assert.equal(result.semanticEngineStatus, "fallback_exact_synonyms");
});

test("analyzeKeywordGaps detects synonyms correctly (e.g. k8s for kubernetes)", () => {
  const resume = createMockResume({
    sections: [
      {
        id: "sec-skills",
        kind: "skills",
        title: "Skills",
        groups: [
          {
            id: "grp-1",
            label: "Tools",
            items: [{ id: "s-1", text: "k8s", hidden: false }],
          },
        ],
        entries: [],
      },
    ],
  });

  const jd = createMockJD({
    keywords: [
      {
        name: "Kubernetes",
        category: "tools",
        required: true,
        evidence: "Kubernetes cluster administration",
      },
    ],
  });

  const profile = createMockMasterProfile();
  const metadata = {
    resumeId: "11111111-1111-4111-8111-111111111111",
    resumeTitle: "Alice",
    resumeVersion: 1,
    profileRevision: 1,
    jdHistoryId: null,
    jobTitle: "DevOps",
    company: "Corp",
  };

  const result = analyzeKeywordGaps(resume, jd, profile, metadata);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.matched[0].keyword, "Kubernetes");
  assert.equal(result.matched[0].matchType, "synonym");
  assert.equal(result.matched[0].matchedText, "k8s");
});

test("analyzeKeywordGaps does not mutate inputs and never exposes contact facts", () => {
  const resume = createMockResume();
  const jd = createMockJD();
  const profile = createMockMasterProfile();

  const resumeBefore = JSON.stringify(resume);
  const jdBefore = JSON.stringify(jd);
  const profileBefore = JSON.stringify(profile);

  const metadata = {
    resumeId: "11111111-1111-4111-8111-111111111111",
    resumeTitle: "Alice",
    resumeVersion: 1,
    profileRevision: 1,
    jdHistoryId: null,
    jobTitle: "Eng",
    company: "Co",
  };

  const result = analyzeKeywordGaps(resume, jd, profile, metadata);

  // Invariant 1: No mutation
  assert.equal(JSON.stringify(resume), resumeBefore);
  assert.equal(JSON.stringify(jd), jdBefore);
  assert.equal(JSON.stringify(profile), profileBefore);

  // Invariant 2: Contact facts never leaked in gap results
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("alice@example.invalid"));
  assert.ok(!serialized.includes("+1 555-0199"));
});
