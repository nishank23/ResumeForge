import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptySection,
  updateInlineDraft,
  emptyEntry,
  mutateTarget,
  canMoveTarget,
  safeLink,
  validateEntry,
  formatDates,
  groupLanguagesUnderSkills,
} from "../src/editor-draft.ts";
import {
  formValues,
  fillEmptyForm,
  projectForm,
  validateForm,
} from "../src/editor-form.ts";
import { createHistory, editorHistory } from "../src/editor-history.ts";
function fixture() {
  const s = emptySection("experience", "exp");
  s.entries = ["a", "b"].map((id) => ({
    ...emptyEntry(id),
    title: id,
    subtitle: "Synthetic company",
    bullets: [
      { id: `${id}-1`, text: "First point", hidden: false },
      { id: `${id}-2`, text: "Second point", hidden: false },
    ],
  }));
  return {
    synthetic: true,
    title: "Demo",
    header: {
      firstName: "Alex",
      lastName: "Rivera",
      headline: "Engineer",
      city: "",
      state: "",
      country: "",
    },
    sampleContact: { phone: "", email: "" },
    sections: [
      emptySection("summary", "summary"),
      s,
      emptySection("skills", "skills"),
      emptySection("languages", "languages"),
    ],
  };
}
test("grouping Languages under Skills preserves IDs, proficiency, visibility and unrelated data", () => {
  const original = fixture();
  original.sections[3].hidden = true;
  original.sections[3].languages = [
    {
      id: "lang-one",
      text: "English",
      proficiency: "User supplied level",
      hidden: false,
    },
  ];
  const draft = groupLanguagesUnderSkills(original);
  assert.equal(
    draft.sections.some((s) => s.kind === "languages"),
    false,
  );
  assert.deepEqual(draft.sections[2].languages, [
    {
      id: "lang-one",
      text: "English",
      proficiency: "User supplied level",
      hidden: true,
    },
  ]);
  assert.deepEqual(draft.sections[1], original.sections[1]);
  assert.deepEqual(draft.sampleContact, original.sampleContact);
  assert.equal(original.sections[3].languages[0].hidden, false);
  assert.deepEqual(groupLanguagesUnderSkills(draft), draft);
});
test("Skills dialog saves categories and languages in one isolated undoable transaction", () => {
  const draft = groupLanguagesUnderSkills(fixture()),
    target = { type: "section", sectionId: "skills" };
  const values = formValues(draft, target);
  values.groups.reverse();
  values.groups[0].items = [
    { id: "skill-one", text: "User supplied skill", hidden: false },
  ];
  values.languages = [
    {
      id: "lang-one",
      text: "English",
      proficiency: "User supplied level",
      hidden: false,
    },
  ];
  values.sampleContact.email = "excluded@example.com";
  assert.deepEqual(validateForm(draft, target, values), []);
  const candidate = projectForm(draft, target, values);
  assert.deepEqual(candidate.sections[2].languages, values.languages);
  assert.deepEqual(candidate.sampleContact, draft.sampleContact);
  assert.deepEqual(candidate.sections[1], draft.sections[1]);
  let history = editorHistory(createHistory(draft), {
    type: "edit",
    value: candidate,
  });
  assert.equal(history.past.length, 1);
  history = editorHistory(history, { type: "undo" });
  assert.deepEqual(history.current, draft);
  assert.deepEqual(draft.sections[2].languages, []);
});
test("Skills rejects duplicate/reserved category names and duplicate tags; autofill follows labels after reordering", () => {
  const draft = groupLanguagesUnderSkills(fixture()),
    target = { type: "section", sectionId: "skills" };
  const values = formValues(draft, target);
  values.groups[0].label = "Languages";
  values.languages = ["English", " english "].map((text, i) => ({
    id: `lang-${i}`,
    text,
    proficiency: "",
    hidden: false,
  }));
  assert.ok(
    validateForm(draft, target, values).some(
      (issue) => issue.path === "groups.0.label",
    ),
  );
  assert.ok(
    validateForm(draft, target, values).some(
      (issue) => issue.path === "languages.1.text",
    ),
  );
  const sample = structuredClone(draft);
  sample.sections[2].groups[0].items = [
    { id: "source-skill", text: "Synthetic programming skill", hidden: false },
  ];
  sample.sections[2].languages = [
    {
      id: "source-lang",
      text: "English",
      proficiency: "Synthetic level",
      hidden: false,
    },
  ];
  const reordered = formValues(draft, target);
  reordered.groups.reverse();
  reordered.languages = [
    { id: "typed-lang", text: "User language", proficiency: "", hidden: false },
  ];
  let sequence = 0;
  const filled = fillEmptyForm(
    reordered,
    target,
    "skills",
    sample,
    () => `new-${sequence++}`,
  );
  assert.equal(
    filled.groups.at(-1).items[0].text,
    "Synthetic programming skill",
  );
  assert.deepEqual(filled.languages, reordered.languages);
  const empty = formValues(draft, target);
  assert.equal(
    fillEmptyForm(empty, target, "skills", sample, () => `new-${sequence++}`)
      .languages[0].proficiency,
    "Synthetic level",
  );
});
test("boundary and stale moves leave draft and history untouched", () => {
  const draft = fixture(),
    original = structuredClone(draft),
    history = createHistory(draft);
  for (const target of [
    { type: "entry", sectionId: "exp", itemId: "a" },
    { type: "bullet", sectionId: "exp", entryId: "a", itemId: "a-1" },
    { type: "section", sectionId: "summary" },
    { type: "entry", sectionId: "exp", itemId: "missing" },
  ]) {
    assert.equal(mutateTarget(draft, target, "up").ok, false);
    assert.equal(canMoveTarget(draft, target, "up"), false);
  }
  assert.equal(
    mutateTarget(
      draft,
      { type: "entry", sectionId: "exp", itemId: "b" },
      "down",
    ).ok,
    false,
  );
  assert.equal(canMoveTarget(draft, { type: "header" }, "down"), false);
  assert.equal(
    canMoveTarget(
      draft,
      { type: "entry", sectionId: "exp", itemId: "a" },
      "down",
    ),
    true,
  );
  assert.equal(
    canMoveTarget(
      draft,
      { type: "entry", sectionId: "exp", itemId: "b" },
      "down",
    ),
    false,
  );
  assert.equal(
    canMoveTarget(draft, { type: "section", sectionId: "summary" }, "down"),
    true,
  );
  assert.deepEqual(draft, original);
  assert.equal(history.past.length, 0);
});
test("stable target moves and hides only the selected list item; delete is undoable", () => {
  const draft = fixture(),
    target = { type: "bullet", sectionId: "exp", entryId: "a", itemId: "a-2" };
  const moved = mutateTarget(draft, target, "up");
  assert.equal(moved.ok, true);
  assert.equal(moved.draft.sections[1].entries[0].bullets[0].id, "a-2");
  assert.deepEqual(
    moved.draft.sections[1].entries[1],
    draft.sections[1].entries[1],
  );
  const hidden = mutateTarget(moved.draft, target, "hide");
  assert.equal(hidden.draft.sections[1].entries[0].bullets[0].hidden, true);
  const removed = mutateTarget(hidden.draft, target, "delete");
  let history = editorHistory(createHistory(hidden.draft), {
    type: "edit",
    value: removed.draft,
  });
  history = editorHistory(history, { type: "undo" });
  assert.deepEqual(history.current, hidden.draft);
  assert.deepEqual(
    draft.sections[1].entries[0].bullets.map((b) => b.id),
    ["a-1", "a-2"],
  );
});
test("dialog candidates are isolated; save affects exactly the target and one workspace history step", () => {
  const draft = fixture(),
    target = { type: "entry", sectionId: "exp", itemId: "b" },
    values = formValues(draft, target);
  values.entry.title = "Revised";
  values.entry.bullets[0].text = "Changed";
  values.sampleContact.email = "never-projected@example.com";
  const candidate = projectForm(draft, target, values);
  assert.equal(draft.sections[1].entries[1].title, "b");
  assert.equal(candidate.sections[1].entries[1].title, "Revised");
  assert.deepEqual(candidate.sampleContact, draft.sampleContact);
  assert.deepEqual(
    candidate.sections[1].entries[0],
    draft.sections[1].entries[0],
  );
  let history = editorHistory(createHistory(draft), {
    type: "edit",
    value: candidate,
  });
  assert.equal(history.past.length, 1);
  history = editorHistory(history, { type: "undo" });
  assert.deepEqual(history.current, draft);
  const header = formValues(draft, { type: "header" });
  header.header.firstName = "New";
  header.sampleContact.phone = "Demo";
  const headerDraft = projectForm(draft, { type: "header" }, header);
  assert.deepEqual(headerDraft.sections, draft.sections);
});
test("date validation rejects reversed, incoherent and current end dates; optional grade stays empty", () => {
  const entry = {
    ...emptyEntry("e"),
    title: "Engineer",
    subtitle: "Synthetic company",
  };
  assert.deepEqual(validateEntry(entry, "experience"), []);
  assert.equal(entry.grade, "");
  entry.dates = {
    startYear: "2024",
    startMonth: "5",
    endYear: "2024",
    endMonth: "4",
    current: false,
    yearOnly: false,
  };
  assert.ok(
    validateEntry(entry, "experience").some(
      (i) => i.path === "entry.dates.endYear",
    ),
  );
  entry.dates.endMonth = "6";
  assert.deepEqual(validateEntry(entry, "experience"), []);
  assert.equal(formatDates(entry.dates), "May 2024 – Jun 2024");
  entry.dates.current = true;
  assert.ok(validateEntry(entry, "experience").length);
  entry.dates.endYear = "";
  entry.dates.endMonth = "";
  assert.deepEqual(validateEntry(entry, "experience"), []);
  entry.dates.startYear = "";
  assert.ok(
    validateEntry(entry, "experience").some(
      (i) => i.path === "entry.dates.startYear",
    ),
  );
});
test("unsafe URLs and missing identity/entry details cannot be saved", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/a",
    "https://user:pass@example.com",
    "not a url",
  ])
    assert.equal(safeLink(url), false);
  assert.equal(safeLink("https://example.com/project"), true);
  const draft = fixture(),
    target = { type: "entry", sectionId: "exp", itemId: "a" },
    values = formValues(draft, target);
  values.entry.title = "";
  values.entry.links = [
    { id: "link", label: "Unsafe", url: "javascript:alert(1)" },
  ];
  assert.ok(
    validateForm(draft, target, values).some((i) => i.path === "entry.title"),
  );
  assert.ok(
    validateForm(draft, target, values).some(
      (i) => i.path === "entry.links.0.url",
    ),
  );
  const header = formValues(draft, { type: "header" });
  header.header.firstName = "";
  header.sampleContact.email = "bad";
  assert.equal(validateForm(draft, { type: "header" }, header).length, 2);
});
test("full draft checkpoint restores names, visibility, order and grouped content together", () => {
  const draft = fixture();
  let history = createHistory(draft);
  const next = structuredClone(draft);
  next.header.lastName = "Edited";
  next.sections[2].groups[0].items.push({
    id: "skill",
    text: "Go",
    hidden: false,
  });
  next.sections[3].languages.push({
    id: "lang",
    text: "English",
    proficiency: "Fluent",
    hidden: false,
  });
  history = editorHistory(history, { type: "edit", value: next });
  history = editorHistory(history, { type: "save" });
  const removed = mutateTarget(
    next,
    { type: "section", sectionId: "exp" },
    "delete",
  );
  history = editorHistory(history, { type: "edit", value: removed.draft });
  history = editorHistory(history, { type: "cancel" });
  assert.deepEqual(history.current, next);
  assert.equal(history.current.header.lastName, "Edited");
  history = editorHistory(history, { type: "undo" });
  assert.equal(
    history.current.sections.some((s) => s.id === "exp"),
    false,
  );
});

test("inline editing validates and changes only its exact field", () => {
  const draft = fixture();
  const changed = updateInlineDraft(
    draft,
    { type: "entry", sectionId: "exp", itemId: "b" },
    "title",
    "  New role  ",
  );
  assert.equal(changed.ok, true);
  assert.equal(changed.draft.sections[1].entries[1].title, "New role");
  assert.deepEqual(changed.draft.sampleContact, draft.sampleContact);
  assert.deepEqual(
    changed.draft.sections[1].entries[0],
    draft.sections[1].entries[0],
  );
  assert.equal(
    updateInlineDraft(draft, { type: "header" }, "email", "invalid").ok,
    false,
  );
  assert.equal(
    updateInlineDraft(
      draft,
      { type: "entry", sectionId: "exp", itemId: "b" },
      "email",
      "x@example.com",
    ).ok,
    false,
  );
  assert.equal(
    updateInlineDraft(
      draft,
      { type: "entry", sectionId: "exp", itemId: "b" },
      "title",
      "",
    ).ok,
    false,
  );
  assert.equal(draft.sections[1].entries[1].title, "b");
});
test("sample autofill preserves typed fields and stable IDs; candidate stays cancelable", () => {
  const sample = fixture();
  sample.sampleContact = { phone: "Demo phone", email: "demo@example.com" };
  const draft = fixture(),
    target = { type: "entry", sectionId: "exp", itemId: "a" };
  const values = formValues(draft, target);
  values.entry.title = "My typed role";
  values.entry.subtitle = "";
  values.entry.bullets = [{ id: "keep-id", text: "", hidden: true }];
  const filled = fillEmptyForm(
    values,
    target,
    "experience",
    sample,
    () => "demo-new-id",
  );
  assert.equal(filled.entry.title, "My typed role");
  assert.equal(filled.entry.subtitle, "Synthetic company");
  assert.equal(filled.entry.id, "a");
  assert.equal(filled.entry.bullets[0].id, "keep-id");
  assert.equal(filled.entry.bullets[0].hidden, true);
  assert.equal(values.entry.subtitle, "");
  assert.equal(draft.sections[1].entries[0].title, "a");
  let history = editorHistory(createHistory(values), {
    type: "edit",
    value: filled,
  });
  history = editorHistory(history, { type: "undo" });
  assert.deepEqual(history.current, values);
  const header = formValues(draft, { type: "header" });
  header.header.firstName = "Keep";
  const headerFilled = fillEmptyForm(
    header,
    { type: "header" },
    undefined,
    sample,
    () => "unused",
  );
  assert.equal(headerFilled.header.firstName, "Keep");
  assert.equal(headerFilled.sampleContact.email, "demo@example.com");
});
test("empty Skills and Languages autofill is target-scoped and does not overwrite rows", () => {
  const sample = fixture();
  sample.sections[2].groups[0].items = [
    { id: "sample-skill", text: "Go", hidden: false },
  ];
  sample.sections[3].languages = [
    {
      id: "sample-language",
      text: "English",
      proficiency: "Fluent",
      hidden: false,
    },
  ];
  const draft = fixture();
  let sequence = 0;
  const skillTarget = { type: "section", sectionId: "skills" },
    values = formValues(draft, skillTarget);
  const filled = fillEmptyForm(
    values,
    skillTarget,
    "skills",
    sample,
    () => `new-${++sequence}`,
  );
  assert.equal(filled.groups[0].items[0].text, "Go");
  assert.notEqual(filled.groups[0].items[0].id, "sample-skill");
  assert.deepEqual(
    projectForm(draft, skillTarget, filled).sections[3],
    draft.sections[3],
  );
  values.groups[0].items = [{ id: "typed", text: "Python", hidden: false }];
  assert.equal(
    fillEmptyForm(values, skillTarget, "skills", sample, () => "unused")
      .groups[0].items[0].text,
    "Python",
  );
  const target = { type: "section", sectionId: "languages" },
    language = fillEmptyForm(
      formValues(draft, target),
      target,
      "languages",
      sample,
      () => "new-language",
    );
  assert.equal(language.languages[0].text, "English");
  assert.equal(language.languages[0].id, "new-language");
});
