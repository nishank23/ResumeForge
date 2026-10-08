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
  assert.ok(
    exp1.bullets[0].text.includes("Architected event-driven microservices"),
  );

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
  const minimal =
    "Bob Stone\nSoftware Developer\nbob@stone.dev\n\nJust a short bio here.";
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

// Synthetic analogue of a visually positioned PDF; no private uploaded facts.
test("plural headings, unmarked wrapped bullets and inline dates retain complete entries", () => {
  const source = `Alex Stone
Software Engineer
alex@example.com\t+1 555 123 4567\talex-profile https://www.linkedin.com/in/alex-profile\tMaputo, Mozambique
SUMMARY
Builds reliable platforms, dashboards and integrations.
WORK EXPERIENCES
Software Engineer | Full-time\tNovember 2023 - Present
Acme Corp\tOn-site • Maputo, Mozambique
Developed a dashboard for operations using
React and Node.js.
Designed a validated REST API.
Technologies / Skills Used : React, Node.js, PostgreSQL
Associate Engineer\tNovember 2022 - July 2023
Beta Corp\tOn-site • Pune, India
Implemented database monitoring.
Technologies / Skills Used : Python, SQL
Intern\tJune 2022 - November 2022
Gamma Corp\tRemote • Austin, USA
Created a reporting tool.
EDUCATIONS
Example University\t2018 - 2022
B.Tech - Information Technology
PROJECTS
Atlas | https://example.com/atlas\tFebruary 2026 - April 2026
Individual Project
Developed a search tool.
Executed scheduled processing.
Technologies / Tools Used : Python, PostgreSQL
Beacon\tSeptember 2024 - May 2025
Developer
Built an inventory system.
Technologies / Tools Used : React, Node.js
SKILLS
Programming Languages: Python, TypeScript
Languages: English, Portuguese`;
  const r = parseResumeText(source);
  assert.equal(r.sections.length, 5);
  assert.equal(r.header.city, "Maputo");
  assert.equal(r.header.state, "Mozambique");
  assert.equal(r.header.links.length, 1);
  const jobs = r.sections.find((s) => s.kind === "experience").entries;
  assert.equal(jobs.length, 3);
  assert.deepEqual(
    jobs.map((e) => e.subtitle),
    ["Acme Corp", "Beta Corp", "Gamma Corp"],
  );
  assert.deepEqual(
    jobs.map((e) => e.bullets.length),
    [2, 1, 1],
  );
  assert.equal(
    jobs[0].bullets[0].text,
    "Developed a dashboard for operations using React and Node.js.",
  );
  assert.equal(jobs[0].employmentType, "Full-time");
  assert.equal(jobs[0].locationType, "On-site");
  assert.equal(jobs[2].locationType, "Remote");
  assert.equal(jobs[0].technologies, "React, Node.js, PostgreSQL");
  assert.equal(jobs[0].startDate, "2023-11");
  assert.equal(jobs[0].endDate, "Present");
  assert.equal(jobs[1].endDate, "2023-07");
  const school = r.sections.find((s) => s.kind === "education").entries;
  assert.equal(school.length, 1);
  assert.equal(school[0].subtitle, "B.Tech");
  assert.equal(school[0].fieldOfStudy, "Information Technology");
  assert.equal(school[0].startDate, "2018");
  assert.equal(school[0].endDate, "2022");
  const projects = r.sections.find((s) => s.kind === "projects").entries;
  assert.deepEqual(
    projects.map((e) => e.title),
    ["Atlas", "Beacon"],
  );
  assert.deepEqual(
    projects.map((e) => e.subtitle),
    ["Individual Project", "Developer"],
  );
  assert.deepEqual(
    projects.map((e) => e.bullets.length),
    [2, 1],
  );
  assert.equal(projects[0].startDate, "2026-02");
  assert.equal(projects[0].endDate, "2026-04");
  assert.equal(projects[0].links[0].url, "https://example.com/atlas");
  assert.equal(projects[1].technologies, "React, Node.js");
  assert.equal(
    r.sections.find((s) => s.kind === "summary").summary,
    "Builds reliable platforms, dashboards and integrations.",
  );
});
test("company and dates on separate lines do not create a duplicate job", () => {
  const r = parseResumeText(`Alex Stone
WORK EXPERIENCE
Developer
Acme Corp
Jan 2020 - Dec 2021
• Built supported functionality.
Engineer
Beta Corp
2022-01 - Present
• Led supported work.`);
  const jobs = r.sections[0].entries;
  assert.deepEqual(
    jobs.map((e) => e.title),
    ["Developer", "Engineer"],
  );
  assert.deepEqual(
    jobs.map((e) => e.subtitle),
    ["Acme Corp", "Beta Corp"],
  );
  assert.equal(jobs[1].startDate, "2022-01");
  assert.equal(jobs[1].isCurrent, true);
});
test("summary commas never become a contact location", () => {
  const r = parseResumeText(
    "Alex Stone\nEngineer\nSUMMARY\nReliable platforms, distributed systems",
  );
  assert.equal(r.header.city, "");
  assert.equal(r.header.state, "");
});
