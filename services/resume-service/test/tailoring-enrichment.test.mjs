import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTailoringPreview,
  tailoringStartSchema,
} from "@resume-forge/shared-types";
import {
  fullTailoringSource,
  inspectFullDraft,
  verifiedFullChanges,
  validateAdditionalFacts,
} from "../dist/tailoring/writer.js";
import { loadResumeApi } from "../../../apps/resume-mfe/test/resume-api-loader.mjs";
const { blankResume, fromResumeContent } = await loadResumeApi();
const jd =
  "Backend Engineer. Python and PostgreSQL required. Build APIs for invoice management and operations.";
function source() {
  const doc = blankResume("Fictional Candidate");
  doc.sampleContact.email = "fixture@example.invalid";
  doc.sections = fromResumeContent({
    sections: [
      {
        id: "projects",
        kind: "projects",
        label: "Projects",
        entries: [
          {
            id: "invoice",
            title: "Invoice application",
            description: "Built a Python invoice application.",
          },
          {
            id: "other",
            title: "Other application",
            description: "Built a scheduling application.",
          },
        ],
      },
    ],
  }).sections;
  return doc;
}
const fact = (kind, text) => ({
  sectionId: "projects",
  itemId: "invoice",
  kind,
  text,
  confirmed: true,
});
function candidate(doc, evidence) {
  const { provider } = fullTailoringSource(doc, evidence);
  return {
    changes: provider.fields.map((f) => ({
      field: f.field,
      proposed: f.original || "Built a Python invoice application.",
      facts: [f.original ? f.field : provider.facts[0].id],
    })),
  };
}
const review = (doc, evidence) => ({
  checks: fullTailoringSource(doc, evidence).provider.fields.map((f) => ({
    field: f.field,
    supported: true,
    complete: true,
  })),
});

test("confirmed experience requires confirmation, unique answers and an owned visible professional target", () => {
  const d = source(),
    f = fact("context", "The operations team needed invoice search.");
  assert.deepEqual(validateAdditionalFacts(d, [f]), [f]);
  for (const input of [
    [{ ...f, confirmed: false }],
    [f, f],
    [{ ...f, itemId: "forged" }],
    [{ ...f, sectionId: "forged" }],
    [{ ...f, text: "fixture@example.invalid" }],
    [{ ...f, text: "Fictional Candidate built it" }],
    [{ ...f, text: "https://example.invalid" }],
  ])
    assert.throws(() => validateAdditionalFacts(d, input));
  d.sections[0].entries[0].hidden = true;
  assert.throws(() => validateAdditionalFacts(d, [f]));
  const request = {
    id: "11111111-1111-4111-8111-111111111111",
    expectedVersion: 1,
    jdText: jd,
    consent: true,
  };
  assert.deepEqual(tailoringStartSchema.parse(request).additionalFacts, []);
  assert.equal(
    tailoringStartSchema.safeParse({
      ...request,
      additionalFacts: [{ ...f, confirmed: false }],
    }).success,
    false,
  );
});
test("confirmed answers remain entry scoped and contact-free in the provider projection", () => {
  const d = source(),
    evidence = {
      complete: true,
      additionalFacts: [
        fact("tools", "PostgreSQL"),
        fact("contribution", "Implemented invoice search using PostgreSQL."),
      ],
    };
  const { provider } = fullTailoringSource(d, evidence);
  const text = JSON.stringify(provider);
  for (const privateValue of [
    "Fictional Candidate",
    "fixture@example.invalid",
    "sectionId",
    "itemId",
  ])
    assert.ok(!text.includes(privateValue));
  assert.equal(
    provider.facts.filter((f) => f.origin === "user-confirmed").length,
    2,
  );
  assert.equal(provider.fields.filter((f) => f.expandable).length, 1);
  const out = candidate(d, evidence),
    other = out.changes.find((f) => f.field === "fact-1");
  other.facts.push("confirmed-0");
  other.proposed = "Built a PostgreSQL scheduling application.";
  assert.ok(inspectFullDraft(d, out, evidence).rejected.includes(other.field));
});
test("thin descriptions expand into supported bullets while new metrics and dropped negation still fail", () => {
  const d = source(),
    evidence = {
      complete: true,
      additionalFacts: [
        fact("tools", "PostgreSQL"),
        fact("contribution", "Implemented invoice search using PostgreSQL."),
        fact("outcome", "The application supported 20 internal users."),
      ],
    };
  const out = candidate(d, evidence),
    entry = out.changes.find((f) => f.field === "fact-0");
  entry.proposed =
    "Built a Python invoice application.\nImplemented invoice search using PostgreSQL.\nSupported 20 internal users.";
  entry.facts = ["fact-0", "confirmed-0", "confirmed-1", "confirmed-2"];
  assert.deepEqual(inspectFullDraft(d, out, evidence).rejected, []);
  entry.proposed = entry.proposed.replace("20", "200");
  assert.ok(inspectFullDraft(d, out, evidence).rejected.includes(entry.field));
  entry.proposed =
    "Built a Python invoice application.\nImplemented invoice search using PostgreSQL.";
  d.sections[0].entries[0].description.content[0].content[0].text +=
    " Did not lead the team.";
  assert.ok(inspectFullDraft(d, out, evidence).rejected.includes(entry.field));
});
test("reviewed summary, tools and skills additions can be selected independently without changing source", () => {
  const d = source(),
    before = structuredClone(d),
    evidence = {
      complete: true,
      additionalFacts: [
        fact("tools", "PostgreSQL"),
        fact("contribution", "Implemented invoice search using PostgreSQL."),
      ],
    };
  const out = candidate(d, evidence),
    row = out.changes.find((f) => f.field === "fact-0");
  row.proposed =
    "Built a Python invoice application.\nImplemented invoice search using PostgreSQL.";
  row.facts = ["fact-0", "confirmed-0", "confirmed-1"];
  const result = verifiedFullChanges(d, jd, out, review(d, evidence), evidence);
  const summary = result.changes.find((c) => c.field === "summary"),
    skills = result.changes.find((c) => c.field === "skills");
  assert.ok(summary);
  assert.ok(skills);
  const onlySummary = applyTailoringPreview(d, result.changes, [summary.id]);
  assert.equal(onlySummary.sections[0].kind, "summary");
  assert.deepEqual(onlySummary.sections[1], d.sections[0]);
  const onlySkills = applyTailoringPreview(d, result.changes, [skills.id]);
  assert.equal(
    onlySkills.sections.some((s) => s.kind === "summary"),
    false,
  );
  assert.equal(
    onlySkills.sections.find((s) => s.kind === "skills").groups[0].items[0]
      .text,
    "PostgreSQL",
  );
  const next = applyTailoringPreview(
    d,
    result.changes,
    result.changes.map((c) => c.id),
  );
  assert.equal(
    next.sections.find((s) => s.kind === "projects").entries[0].description
      .content[0].type,
    "bulletList",
  );
  assert.equal(
    next.sections.find((s) => s.kind === "projects").entries[0].technologies,
    "PostgreSQL",
  );
  assert.deepEqual(d, before);
});
test("an empty existing entry can use confirmed work without manufacturing another job", () => {
  const d = source();
  d.sections[0].entries.forEach((e) => {
    e.description = { type: "doc", content: [] };
  });
  const evidence = {
    complete: true,
    additionalFacts: [
      fact("contribution", "Built a Python invoice application."),
    ],
  };
  const out = candidate(d, evidence);
  for (const row of out.changes) {
    row.proposed = "Built a Python invoice application.";
    row.facts = ["confirmed-0"];
  }
  assert.deepEqual(inspectFullDraft(d, out, evidence).rejected, []);
  const result = verifiedFullChanges(d, jd, out, review(d, evidence), evidence),
    next = applyTailoringPreview(
      d,
      result.changes,
      result.changes.map((c) => c.id),
    );
  assert.equal(
    next.sections.find((s) => s.kind === "projects").entries.length,
    2,
  );
  assert.equal(
    next.sections.find((s) => s.kind === "projects").entries[0].id,
    "invoice",
  );
});
test("entry IDs containing separators cannot mix confirmed evidence across entries", () => {
  const d = source();
  d.sections[0].id = "projects:team";
  const other = structuredClone(d.sections[0]);
  other.id = "projects";
  other.entries = [
    { ...structuredClone(other.entries[0]), id: "team:invoice" },
  ];
  d.sections.push(other);
  const answers = [
    { ...fact("tools", "PostgreSQL"), sectionId: "projects:team" },
    {
      ...fact("tools", "Spark"),
      sectionId: "projects",
      itemId: "team:invoice",
    },
  ];
  const evidence = { complete: true, additionalFacts: answers },
    provider = fullTailoringSource(d, evidence).provider;
  assert.notEqual(
    provider.facts.find((f) => f.id === "confirmed-0").scope,
    provider.facts.find((f) => f.id === "confirmed-1").scope,
  );
});

test("accidental UI progress text is rejected before provider projection", () => {
  const d = source(),
    input = [
      fact(
        "contribution",
        "3 of 4 stages complete. You can close this dialog and reopen it to check progress.",
      ),
    ];
  assert.throws(() => validateAdditionalFacts(d, input), /actual work/);
  assert.throws(
    () => fullTailoringSource(d, { complete: true, additionalFacts: input }),
    /actual work/,
  );
});

test("provider identifies standalone achievements and keeps them visible during correction", () => {
  const d = source();
  d.sections[0].entries[0].bullets = [
    {
      id: "invoice-bullet",
      text: "Created invoice search using Python.",
      hidden: false,
    },
  ];
  const { provider } = fullTailoringSource(d);
  const achievement = provider.fields.find((f) =>
    f.original.startsWith("Created invoice"),
  );
  assert.equal(achievement.kind, "achievement");
  assert.ok(
    provider.contexts
      .find((c) => c.scope === achievement.scope)
      .achievements.includes(achievement.field),
  );
});

test("new descriptions cannot repeat retained achievements, even if that achievement rewrite is rejected", () => {
  const d = source();
  d.sections[0].entries[0].description = { type: "doc", content: [] };
  d.sections[0].entries[0].bullets = [
    {
      id: "invoice-bullet",
      text: "Created invoice search using Python.",
      hidden: false,
    },
  ];
  const before = structuredClone(d);
  const evidence = {
    additionalFacts: [
      fact(
        "contribution",
        "Created invoice search using Python. Added invoice validation.",
      ),
    ],
  };
  const out = candidate(d, evidence);
  const fields = fullTailoringSource(d, evidence).fields;
  const description = fields.find(
    (f) => f.field === "description" && f.target.itemId === "invoice",
  );
  const row = out.changes.find((r) => r.field === description.id);
  row.proposed =
    "Created invoice search using Python.\nAdded invoice validation.";
  row.facts = ["confirmed-0"];
  const inspected = inspectFullDraft(d, out, evidence);
  assert.ok(inspected.rejected.includes(description.id));
  const result = verifiedFullChanges(d, jd, out, review(d, evidence), evidence);
  assert.ok(!result.changes.some((c) => c.id === description.id));
  assert.deepEqual(d, before);
  row.proposed = "Added invoice validation.";
  const valid = verifiedFullChanges(d, jd, out, review(d, evidence), evidence);
  assert.ok(valid.changes.some((c) => c.id === description.id));
  const onlyDescription = applyTailoringPreview(d, valid.changes, [
    description.id,
  ]);
  assert.deepEqual(
    onlyDescription.sections[0].entries[0].bullets,
    before.sections[0].entries[0].bullets,
  );
  assert.ok(
    JSON.stringify(onlyDescription).includes("Added invoice validation."),
  );
});

test("semantic duplication fails independent review while unchanged originals and different entries survive", () => {
  const d = source();
  const out = candidate(d);
  const changed = out.changes.find((r) => r.field === "fact-0");
  changed.proposed = "Developed a Python invoice application.";
  const verdict = review(d);
  verdict.checks.find((r) => r.field === changed.field).complete = false;
  const result = verifiedFullChanges(d, jd, out, verdict);
  assert.ok(!result.changes.some((c) => c.id === changed.field));
  assert.ok(result.warnings.length);
  // Identical prose in different jobs/projects is not a within-entry duplicate.
  d.sections[0].entries[1].description = structuredClone(
    d.sections[0].entries[0].description,
  );
  assert.deepEqual(inspectFullDraft(d, candidate(d)).rejected, []);
});

test("an empty description stays empty when confirmed facts only repeat its retained achievements", () => {
  const d = source();
  d.sections[0].entries[0].description = { type: "doc", content: [] };
  d.sections[0].entries[0].bullets = [
    {
      id: "existing",
      text: "Created invoice search using Python.",
      hidden: false,
    },
  ];
  const evidence = {
    additionalFacts: [
      fact("contribution", "Created invoice search using Python."),
    ],
  };
  const out = candidate(d, evidence);
  const description = fullTailoringSource(d, evidence).fields.find(
    (f) => f.field === "description" && f.target.itemId === "invoice",
  );
  Object.assign(
    out.changes.find((c) => c.field === description.id),
    { proposed: "", facts: ["confirmed-0"] },
  );
  assert.deepEqual(inspectFullDraft(d, out, evidence).rejected, []);
  const result = verifiedFullChanges(d, jd, out, review(d, evidence), evidence);
  assert.ok(!result.changes.some((c) => c.id === description.id));
});

test("duplicate checks preserve distinct technology names rather than conflating C++ and C#", () => {
  const d = source();
  d.sections[0].entries[0].bullets = [
    { id: "cpp", text: "Built C++ APIs for invoice search.", hidden: false },
  ];
  const evidence = {
    additionalFacts: [
      fact("contribution", "Built C# APIs for invoice search."),
    ],
  };
  const out = candidate(d, evidence);
  const row = out.changes.find((r) => r.field === "fact-0");
  row.proposed =
    "Built a Python invoice application.\nBuilt C# APIs for invoice search.";
  row.facts = ["fact-0", "confirmed-0"];
  assert.ok(!inspectFullDraft(d, out, evidence).rejected.includes(row.field));
});
