import test from "node:test";
import assert from "node:assert/strict";
import {
  experienceEntries,
  confirmExperience,
  experienceQuestions,
  experiencePrompts,
  experienceQuestionLabel,
} from "../src/tailoring-experience.ts";
import { loadResumeApi } from "./resume-api-loader.mjs";
const { blankResume, fromResumeContent } = await loadResumeApi();
function doc() {
  const d = blankResume();
  d.sections = fromResumeContent({
    sections: [
      {
        id: "work",
        kind: "experience",
        entries: [
          { id: "first", title: "Engineer", description: "Built Python APIs." },
          { id: "hidden", hidden: true, description: "Hidden entry" },
        ],
      },
    ],
  }).sections;
  return d;
}
test("experience intake presents three optional questions and excludes hidden entries", () => {
  assert.equal(experienceQuestions.length, 3);
  const entries = experienceEntries(doc());
  assert.equal(entries.length, 1);
  assert.equal(entries[0].thin, true);
  assert.equal(entries[0].description, "Built Python APIs.");
});
test("fact confirmation trims answers, skips blanks and binds the visible source entry", () => {
  const d = doc(),
    answers = [
      {
        sectionId: "work",
        itemId: "first",
        kind: "contribution",
        text: " Implemented invoice search. ",
      },
      { sectionId: "work", itemId: "first", kind: "outcome", text: "   " },
    ];
  const before = structuredClone(d),
    facts = confirmExperience(d, answers);
  assert.equal(facts.length, 1);
  assert.equal(facts[0].confirmed, true);
  assert.equal(facts[0].text, "Implemented invoice search.");
  assert.deepEqual(d, before);
  assert.throws(() =>
    confirmExperience(d, [{ ...answers[0], itemId: "hidden" }]),
  );
  assert.throws(() => confirmExperience(d, [answers[0], answers[0]]));
  assert.deepEqual(confirmExperience(d, []), []);
});

test("earlier context and detail answers remain labelled and confirmable", () => {
  const answers = [
    {
      sectionId: "work",
      itemId: "first",
      kind: "context",
      text: "Finance needed searchable invoices.",
    },
    {
      sectionId: "work",
      itemId: "first",
      kind: "details",
      text: "Handled database schema changes.",
    },
  ];
  const facts = confirmExperience(doc(), answers);
  assert.deepEqual(
    facts.map(({ confirmed, ...answer }) => answer),
    answers,
  );
  assert.equal(
    experienceQuestionLabel("context"),
    "What problem were you solving?",
  );
  assert.equal(
    experienceQuestionLabel("details"),
    "What else should this application show?",
  );
});

test("adaptive intake prioritizes related thin entries and caps the whole interview at three", () => {
  const d = doc();
  d.sections[0].entries.push({
    ...structuredClone(d.sections[0].entries[0]),
    id: "unrelated",
    title: "Java developer",
    description: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Built Java applications." }],
        },
      ],
    },
  });
  const prompts = experiencePrompts(d, ["Python", "Kubernetes"]);
  assert.ok(prompts.length > 0 && prompts.length <= 3);
  assert.ok(prompts.every((p) => p.entry.itemId === "first"));
  assert.ok(!prompts.some((p) => p.kind === "tools"));
  assert.ok(!prompts.some((p) => p.label.includes("Kubernetes")));
  assert.deepEqual(confirmExperience(d, []), []);
});
test("complete evidence needs no extra questions, while vague outcomes remain optional prompts", () => {
  const d = doc(),
    entry = d.sections[0].entries[0];
  entry.technologies = "Python, PostgreSQL";
  const text =
    "Built Python APIs for invoice creation and search. Added input validation and clear error handling. Connected PostgreSQL records to the API and wrote automated tests. Documented endpoint usage for operations staff. Supported 20 internal users and reduced duplicate invoice entries by 25%.";
  entry.description = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
  assert.deepEqual(experiencePrompts(d, ["Python"]), []);
  entry.description.content[0].content[0].text = text.replace(
    "Supported 20 internal users and reduced duplicate invoice entries by 25%.",
    "The project also included API reference documentation and a local setup guide.",
  );
  assert.deepEqual(
    experiencePrompts(d, ["Python"]).map((p) => p.kind),
    ["outcome"],
  );
});
test("loading messages are not professional facts and the source stays unchanged", () => {
  const d = doc(),
    before = structuredClone(d);
  for (const text of [
    "3 of 4 stages complete. You can close this dialog and reopen it to check progress.",
    "Tailoring queued…",
  ])
    assert.throws(
      () =>
        confirmExperience(d, [
          { sectionId: "work", itemId: "first", kind: "contribution", text },
        ]),
      /actual work/,
    );
  assert.deepEqual(d, before);
});

test("saved qualitative outcomes skip repeated outcome questions regardless of verb tense", () => {
  const d = doc(),
    entry = d.sections[0].entries[0];
  entry.technologies = "Python";
  for (const outcome of [
    "enabled staff to retrieve invoices",
    "enabling staff to retrieve invoices",
    "supports operations staff",
    "reducing duplicate records",
  ]) {
    entry.description = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `Built Python APIs for invoice creation and search. Added input validation and clear error handling. Connected database records to the API and wrote automated tests. Documented endpoint usage, required fields and error responses for operations staff, ${outcome}.`,
            },
          ],
        },
      ],
    };
    assert.ok(
      !experiencePrompts(d, ["Python"]).some(
        (prompt) => prompt.kind === "outcome",
      ),
    );
  }
});
