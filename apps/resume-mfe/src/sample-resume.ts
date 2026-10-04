import type { DocumentSectionBlock } from "@resume-forge/shared";

// Display-only synthetic fixture. Never use this as a profile, API or contact DTO.
export interface SampleResumeEntry {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly period: string;
  readonly location?: string;
  readonly bullets: readonly string[];
  readonly technologies?: string;
}

type SectionPresentation =
  | { readonly kind: "summary" }
  | { readonly kind: "entries"; readonly entries: readonly SampleResumeEntry[] }
  | {
      readonly kind: "skills";
      readonly groups: readonly {
        readonly label: string;
        readonly values: string;
      }[];
    }
  | { readonly kind: "languages"; readonly values: readonly string[] };

export type SampleResumeSection = DocumentSectionBlock & {
  readonly presentation: SectionPresentation;
};

export interface SampleResumeDocument {
  readonly title: string;
  readonly name: string;
  readonly headline: string;
  readonly phone: string;
  readonly email: string;
  readonly location: string;
  readonly sections: readonly SampleResumeSection[];
}

export const SAMPLE_RESUME: SampleResumeDocument = {
  title: "Backend engineer",
  name: "Alex Rivera",
  headline: "Backend Engineer",
  phone: "+1 (202) 555-0142",
  email: "alex.rivera@example.com",
  location: "Example City, Example Country",
  sections: [
    {
      sectionId: "sec-summary",
      sectionLabel: "Professional Summary",
      itemId: "item-summary-01",
      itemLabel: "Executive Overview",
      content:
        "Backend engineer with 7 years of experience building distributed microservices, event-driven data pipelines, and resilient API gateways.",
      presentation: { kind: "summary" },
    },
    {
      sectionId: "sec-exp-1",
      sectionLabel: "Work Experience",
      itemId: "item-exp-01",
      itemLabel: "Staff Engineer",
      content:
        "Staff Engineer at Synthetic Cloud Systems, 2022–Present. Led migration of core billing ingestion pipeline to partitioned stream workers, reducing p99 latency from 420ms to 95ms across 45k req/sec.",
      presentation: {
        kind: "entries",
        entries: [
          {
            id: "sample-experience-01",
            title: "Staff Engineer",
            subtitle: "Synthetic Cloud Systems",
            period: "2022–Present",
            location: "Remote",
            bullets: [
              "Led migration of core billing ingestion pipeline to partitioned stream workers, reducing p99 latency from 420ms to 95ms across 45k req/sec.",
              "Designed resilient API gateways and event-driven services for the platform team.",
            ],
            technologies: "TypeScript, Go, Kafka, PostgreSQL",
          },
        ],
      },
    },
    {
      sectionId: "sec-education",
      sectionLabel: "Education",
      itemId: "item-education-01",
      itemLabel: "Example Institute of Technology",
      content:
        "Example Institute of Technology, 2015–2019. Bachelor of Science in Computer Science. Example City.",
      presentation: {
        kind: "entries",
        entries: [
          {
            id: "sample-education-01",
            title: "Example Institute of Technology",
            subtitle: "Bachelor of Science in Computer Science",
            period: "2015–2019",
            location: "Example City",
            bullets: [
              "Coursework: distributed systems, database design and software engineering.",
            ],
          },
        ],
      },
    },
    {
      sectionId: "sec-proj-1",
      sectionLabel: "Projects",
      itemId: "item-proj-01",
      itemLabel: "SchemaGuard Open-Source Validator",
      content:
        "SchemaGuard Open-Source Validator, 2023–2024. Created deterministic contract validator for TypeScript and JSONB schemas with zero runtime dependencies.",
      presentation: {
        kind: "entries",
        entries: [
          {
            id: "sample-project-01",
            title: "SchemaGuard Open-Source Validator",
            subtitle: "Maintainer",
            period: "2023–2024",
            bullets: [
              "Created deterministic contract validator for TypeScript and JSONB schemas with zero runtime dependencies.",
            ],
            technologies: "TypeScript, Node.js, PostgreSQL",
          },
        ],
      },
    },
    {
      sectionId: "sec-skills",
      sectionLabel: "Skills",
      itemId: "item-skills-01",
      itemLabel: "Grouped skills",
      content:
        "Programming Languages: TypeScript, Go. Frameworks & Libraries: Express. Tools & Platforms: Node.js, Kafka, Redis, OpenTelemetry, Kubernetes. Databases: PostgreSQL, pgvector. Soft Skills: Technical communication, mentoring.",
      presentation: {
        kind: "skills",
        groups: [
          { label: "Programming Languages", values: "TypeScript, Go" },
          { label: "Frameworks & Libraries", values: "Express" },
          {
            label: "Tools & Platforms",
            values: "Node.js, Kafka, Redis, OpenTelemetry, Kubernetes",
          },
          { label: "Databases", values: "PostgreSQL, pgvector" },
          {
            label: "Soft Skills",
            values: "Technical communication, mentoring",
          },
        ],
      },
    },
    {
      sectionId: "sec-languages",
      sectionLabel: "Languages",
      itemId: "item-languages-01",
      itemLabel: "Spoken languages",
      content: "English (fluent), Spanish (conversational).",
      presentation: {
        kind: "languages",
        values: ["English (fluent)", "Spanish (conversational)"],
      },
    },
  ],
};
