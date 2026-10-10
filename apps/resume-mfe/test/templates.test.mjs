import test from "node:test";
import assert from "node:assert/strict";
import {
  RESUME_TEMPLATES,
  matchingTemplate,
  templateAppearance,
} from "../src/templates/registry.ts";
import {
  DEFAULT_APPEARANCE,
  updateAppearance,
} from "../src/editor-appearance.ts";
import { createHistory, editorHistory } from "../src/editor-history.ts";
import { loadResumeApi } from "./resume-api-loader.mjs";
const { blankResume, toResumeContent, fromResumeContent } =
  await loadResumeApi();

test("all original templates preserve facts and persist exact validated appearance through the save envelope", () => {
  assert.equal(RESUME_TEMPLATES.length, 3);
  assert.equal(new Set(RESUME_TEMPLATES.map((t) => t.id)).size, 3);
  assert.equal(
    new Set(RESUME_TEMPLATES.map((t) => JSON.stringify(t.appearance))).size,
    3,
  );
  const draft = blankResume("Alex Rivera");
  const before = structuredClone(draft);
  for (const template of RESUME_TEMPLATES) {
    assert.equal(template.version, 1);
    const next = templateAppearance(template.id);
    assert.equal(matchingTemplate(next)?.id, template.id);
    const result = updateAppearance(draft, next);
    assert.equal(result.ok, true);
    const { appearance, ...facts } = result.draft;
    assert.deepEqual(facts, before);
    assert.deepEqual(
      fromResumeContent(toResumeContent(result.draft)),
      result.draft,
    );
    next.typography.body.size = 18;
    assert.notEqual(template.appearance.typography.body.size, 18);
    assert.deepEqual(appearance, template.appearance);
  }
  assert.deepEqual(draft, before);
  assert.equal(templateAppearance("unknown-template"), undefined);
});

test("template switching remains undoable, cancellable and custom formatting is honestly labeled", () => {
  const original = blankResume();
  const modern = updateAppearance(
    original,
    templateAppearance("forge-modern"),
  ).draft;
  let history = editorHistory(createHistory(original), {
    type: "edit",
    value: modern,
  });
  assert.deepEqual(editorHistory(history, { type: "undo" }).current, original);
  history = editorHistory(history, { type: "save" });
  const editorial = updateAppearance(
    modern,
    templateAppearance("forge-editorial"),
  ).draft;
  history = editorHistory(history, { type: "edit", value: editorial });
  assert.deepEqual(editorHistory(history, { type: "cancel" }).current, modern);
  const custom = structuredClone(DEFAULT_APPEARANCE);
  custom.left = 50;
  assert.equal(matchingTemplate(custom), undefined);
});
