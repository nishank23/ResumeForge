import test from "node:test";
import assert from "node:assert/strict";
import { parseResumeText } from "../dist/parser.js";

const sampleResumeText = `
Alex Mercer
Senior Full Stack Engineer
San Francisco, CA
alex.mercer@example.com | (555) 123-4567 | linkedin.com/in/alexmercer | github.com/alexmercer

Professional Summary
Passionate software engineer with 8+ years of experience designing, building, and deploying large-scale cloud-native applications with high availability and throughput.

Work Experience
Staff Engineer - Acme Corp - San Francisco, CA
2021-03 - Present
• Architected event-driven microservices processing 50M events daily using Kafka and Node.js.
• Mentored a team of 12 engineers and improved deployment frequency by 40%.
• Reduced p99 API latency from 250ms to 45ms through distributed query optimization.

Senior Software Engineer - Techflow Inc
2018-06 - 2021-02
• Built real-time analytics dashboard with React, TypeScript, and WebSockets.
• Led migration from monolith to Kubernetes cluster in AWS, saving $120k annually.

Education
University of California, Berkeley - B.S. - Computer Science
2014 - 2018
GPA: 3.8/4.0

Skills
Languages: TypeScript, JavaScript, Python, Go, SQL
Frameworks: React, Next.js, Node.js, Express, Hono, NestJS
Databases: PostgreSQL, Redis, MongoDB
Tools: Docker, Kubernetes, AWS, Git, CI/CD

Projects
ResumeForge | React, TypeScript, Hono
• Open-source AI resume tailor and professional profile manager.
• Implemented client-side microfrontends and strictly isolated RBAC services.

Certifications
• AWS Certified Solutions Architect Professional
• Certified Kubernetes Administrator (CKA)
`;

test("heuristic parser extracts header, contacts, and links correctly", () => {
  const result = parseResumeText(sampleResumeText, "Alex_Mercer_Resume.pdf");

  assert.equal(result.header.fullName, "Alex Mercer");
  assert.equal(result.header.firstName, "Alex");
  assert.equal(result.header.lastName, "Mercer");
  assert.equal(result.header.headline, "Senior Full Stack Engineer");
  assert.equal(result.header.email, "alex.mercer@example.com");
  assert.equal(result.header.phone, "(555) 123-4567");
  assert.equal(result.header.city, "San Francisco");
  assert.equal(result.header.state, "CA");

  const linkedin = result.header.links.find((l) => l.label === "LinkedIn");
  assert.ok(linkedin);
  assert.equal(linkedin.url, "https://www.linkedin.com/in/alexmercer");

  const github = result.header.links.find((l) => l.label === "GitHub");
  assert.ok(github);
  assert.equal(github.url, "https://github.com/alexmercer");
});

test("heuristic parser segments and structures all major resume sections", () => {
  const result = parseResumeText(sampleResumeText, "Alex_Mercer_Resume.pdf");

  assert.equal(result.title, "Alex_Mercer_Resume");

  // 1. Summary
  const summarySec = result.sections.find((s) => s.kind === "summary");
  assert.ok(summarySec);
  assert.ok(summarySec.summary.includes("Passionate software engineer"));

  // 2. Experience
  const expSec = result.sections.find((s) => s.kind === "experience");
  assert.ok(expSec);
  assert.equal(expSec.entries.length, 2);

  const exp1 = expSec.entries[0];
  assert.equal(exp1.title, "Staff Engineer");
  assert.equal(exp1.subtitle, "Acme Corp");
  assert.equal(exp1.isCurrent, true);
  assert.equal(exp1.bullets.length, 3);
  assert.ok(exp1.bullets[0].text.includes("Architected event-driven microservices"));

  const exp2 = expSec.entries[1];
  assert.equal(exp2.title, "Senior Software Engineer");
  assert.equal(exp2.subtitle, "Techflow Inc");
  assert.equal(exp2.isCurrent, false);
  assert.equal(exp2.bullets.length, 2);

  // 3. Education
  const eduSec = result.sections.find((s) => s.kind === "education");
  assert.ok(eduSec);
  assert.equal(eduSec.entries.length, 1);
  const edu1 = eduSec.entries[0];
  assert.equal(edu1.title, "University of California, Berkeley");
  assert.equal(edu1.subtitle, "B.S.");
  assert.equal(edu1.fieldOfStudy, "Computer Science");
  assert.equal(edu1.grade, "3.8/4.0");

  // 4. Skills
  const skillsSec = result.sections.find((s) => s.kind === "skills");
  assert.ok(skillsSec);
  assert.ok(skillsSec.groups.length >= 3);
  const langGroup = skillsSec.groups.find((g) => g.label === "Languages");
  assert.ok(langGroup);
  assert.ok(langGroup.items.some((i) => i.text === "TypeScript"));
  assert.ok(langGroup.items.some((i) => i.text === "Python"));

  // 5. Projects
  const projSec = result.sections.find((s) => s.kind === "projects");
  assert.ok(projSec);
  assert.equal(projSec.entries.length, 1);
  const proj1 = projSec.entries[0];
  assert.equal(proj1.title, "ResumeForge");
  assert.ok(proj1.technologies.includes("React"));
  assert.equal(proj1.bullets.length, 2);

  // 6. Certifications
  const certSec = result.sections.find((s) => s.kind === "certifications");
  assert.ok(certSec);
  assert.equal(certSec.entries.length, 1);
  assert.equal(certSec.entries[0].bullets.length, 2);
  assert.ok(certSec.entries[0].bullets[0].text.includes("AWS Certified"));
});

test("heuristic parser handles minimal resume without sections gracefully", () => {
  const minimal = "Bob Stone\nSoftware Developer\nbob@stone.dev\n\nJust a short bio here.";
  const result = parseResumeText(minimal);

  assert.equal(result.header.fullName, "Bob Stone");
  assert.equal(result.header.firstName, "Bob");
  assert.equal(result.header.lastName, "Stone");
  assert.equal(result.header.headline, "Software Developer");
  assert.equal(result.header.email, "bob@stone.dev");
  assert.equal(result.sections.length, 0);
});

test("heuristic parser handles comma-separated flat skills list", () => {
  const text = `
Sarah Connor
Defender
sarah@skynet.resistance

Skills
C++, Rust, Linux, Reverse Engineering, Cybersecurity
`;
  const result = parseResumeText(text);
  const skillsSec = result.sections.find((s) => s.kind === "skills");
  assert.ok(skillsSec);
  assert.ok(skillsSec.groups.length >= 1);
  const general = skillsSec.groups[0];
  assert.ok(general.items.some((i) => i.text === "Rust"));
  assert.ok(general.items.some((i) => i.text === "Linux"));
});

