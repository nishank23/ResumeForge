import { test } from "node:test";
import assert from "node:assert/strict";
import { emptySection, emptyEntry } from "../src/editor-draft.ts";
import { createHistory, editorHistory } from "../src/editor-history.ts";
import {
  createLocalAiPreview,
  acceptLocalAiPreview,
} from "../src/editor-ai-preview.ts";

function fixture() {
  const summary = emptySection("summary", "summary");
  summary.summary.content = [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Engineer with 7 years of experience building APIs.",
          marks: [{ type: "bold" }],
        },
        { type: "hardBreak" },
        { type: "text", text: "TypeScript, Kafka and PostgreSQL." },
      ],
    },
  ];
  const experience = emptySection("experience", "experience");
  const entry = emptyEntry("entry");
  entry.title = "Engineer";
  entry.subtitle = "Fictional Company";
  entry.dates.startYear = "2022";
  entry.bullets = [
    {
      id: "first",
      text: "Led migration of APIs in order to reduce latency from 420ms to 95ms.",
      hidden: false,
    },
    {
      id: "second",
      text: "Created deterministic validator for 45k req/sec.",
      hidden: false,
    },
  ];
  experience.entries = [entry];
  return {
    synthetic: true,
    title: "Synthetic",
    header: {
      firstName: "Alex",
      lastName: "Rivera",
      headline: "Engineer",
      city: "",
      state: "",
      country: "",
    },
    sampleContact: {
      phone: "+1 (202) 555-0142",
      email: "alex.rivera@example.com",
    },
    sections: [summary, experience, emptySection("skills", "skills")],
  };
}

test("bullet review and acceptance preserve metrics, contacts, sibling content and one-step Undo", () => {
  const draft = fixture();
  const before = structuredClone(draft);
  const preview = createLocalAiPreview(draft, {
    type: "bullet",
    sectionId: "experience",
    entryId: "entry",
    itemId: "first",
  });
  assert.deepEqual(draft, before);
  assert.equal(preview.changes.length, 1);
  const expected = structuredClone(draft);
  expected.sections[1].entries[0].bullets[0].text =
    "Led the migration of APIs to reduce latency from 420ms to 95ms.";
  const accepted = acceptLocalAiPreview(draft, preview);
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.draft, expected);
  const history = editorHistory(createHistory(draft), {
    type: "edit",
    value: accepted.draft,
  });
  assert.equal(history.past.length, 1);
  assert.deepEqual(editorHistory(history, { type: "undo" }).current, draft);
  assert.deepEqual(
    editorHistory(editorHistory(history, { type: "undo" }), { type: "redo" })
      .current,
    expected,
  );
});

test("rich-text preview preserves marks, breaks, nested structure and unrelated facts", () => {
  const draft = fixture();
  draft.sections[0].summary.content.push({
    type: "bulletList",
    content: [
      {
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Created deterministic validator.",
                marks: [{ type: "italic" }],
              },
            ],
          },
        ],
      },
    ],
  });
  const preview = createLocalAiPreview(draft, {
    type: "section",
    sectionId: "summary",
  });
  const expected = structuredClone(draft);
  expected.sections[0].summary.content[0].content[0].text =
    "Engineer with 7 years’ experience building APIs.";
  expected.sections[0].summary.content[1].content[0].content[0].content[0].text =
    "Created a deterministic validator.";
  assert.deepEqual(preview.candidate, expected);
  assert.equal(preview.changes.length, 1);
});

test("entry and section previews stay scoped and omit hidden entries and bullets", () => {
  const draft = fixture();
  const hidden = structuredClone(draft.sections[1].entries[0]);
  hidden.id = "hidden";
  hidden.hidden = true;
  draft.sections[1].entries.push(hidden);
  draft.sections[1].entries[0].bullets[1].hidden = true;
  for (const target of [
    { type: "entry", sectionId: "experience", itemId: "entry" },
    { type: "section", sectionId: "experience" },
  ]) {
    const preview = createLocalAiPreview(draft, target);
    assert.equal(preview.changes.length, 1);
    assert.deepEqual(preview.candidate.sections[1].entries[1], hidden);
    assert.deepEqual(
      preview.candidate.sections[1].entries[0].bullets[1],
      draft.sections[1].entries[0].bullets[1],
    );
    assert.deepEqual(preview.candidate.sections[0], draft.sections[0]);
  }
  assert.equal(
    createLocalAiPreview(draft, {
      type: "bullet",
      sectionId: "experience",
      entryId: "hidden",
      itemId: "first",
    }).changes.length,
    0,
  );
});

test("no changes, empty, missing, hidden and protected targets do not mutate history or offer acceptance", () => {
  const draft = fixture();
  draft.sections[0].summary.content = [{ type: "paragraph" }];
  draft.sections[1].entries[0].bullets[0].hidden = true;
  const before = structuredClone(draft);
  for (const target of [
    { type: "header" },
    { type: "section", sectionId: "skills" },
    { type: "section", sectionId: "summary" },
    { type: "entry", sectionId: "missing", itemId: "entry" },
    {
      type: "bullet",
      sectionId: "experience",
      entryId: "entry",
      itemId: "first",
    },
  ]) {
    const preview = createLocalAiPreview(draft, target);
    assert.equal(preview.changes.length, 0);
    assert.deepEqual(preview.candidate, draft);
    assert.equal(acceptLocalAiPreview(draft, preview).ok, false);
  }
  draft.sections[0].summary.content = [
    { type: "paragraph", content: [{ type: "text", text: "Designed APIs." }] },
  ];
  assert.equal(
    createLocalAiPreview(draft, { type: "section", sectionId: "summary" })
      .changes.length,
    0,
  );
  draft.sections[0].hidden = true;
  assert.equal(
    createLocalAiPreview(draft, { type: "section", sectionId: "summary" })
      .changes.length,
    0,
  );
  assert.deepEqual(before.sampleContact, draft.sampleContact);
});

test("a newer draft rejects a late result rather than overwriting a manual edit or removed target", () => {
  const base = fixture();
  const preview = createLocalAiPreview(base, {
    type: "section",
    sectionId: "summary",
  });
  for (const mutate of [
    (draft) => {
      draft.header.headline = "Updated manually";
    },
    (draft) => {
      draft.sections.shift();
    },
    (draft) => {
      draft.sections[0].summary.content[0].content[0].text = "Manual revision";
    },
  ]) {
    const current = structuredClone(base);
    mutate(current);
    const before = structuredClone(current);
    assert.equal(acceptLocalAiPreview(current, preview).ok, false);
    assert.deepEqual(current, before);
  }
});
