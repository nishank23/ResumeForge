import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_APPEARANCE,
  appearancePreset,
  updateAppearance,
  appearanceVariables,
} from "../src/editor-appearance.ts";
import { createHistory, editorHistory } from "../src/editor-history.ts";
const draft = {
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
  sections: [{ id: "summary", text: "Preserve every supported fact." }],
};
test("formatting preserves all facts and separate contacts; Save, Cancel and Undo cover appearance", () => {
  const result = updateAppearance(draft, appearancePreset("compact"));
  assert.equal(result.ok, true);
  const { appearance, ...facts } = result.draft;
  assert.deepEqual(facts, draft);
  assert.equal(appearance.typography.body.size, 13);
  assert.equal(draft.appearance, undefined);
  let state = editorHistory(createHistory(draft), {
    type: "edit",
    value: result.draft,
  });
  assert.deepEqual(editorHistory(state, { type: "undo" }).current, draft);
  state = editorHistory(state, { type: "save" });
  state = editorHistory(state, {
    type: "edit",
    value: updateAppearance(state.current, appearancePreset("spacious")).draft,
  });
  assert.deepEqual(
    editorHistory(state, { type: "cancel" }).current.appearance,
    appearance,
  );
});
test("unsafe fonts/colors and unreadable/nonfinite formatting fail without mutation", () => {
  for (const patch of [
    { sectionGap: 0 },
    { left: Infinity },
    { itemGap: 6.5 },
    {
      typography: {
        ...DEFAULT_APPEARANCE.typography,
        body: { ...DEFAULT_APPEARANCE.typography.body, size: 8 },
      },
    },
    {
      typography: {
        ...DEFAULT_APPEARANCE.typography,
        body: {
          ...DEFAULT_APPEARANCE.typography.body,
          font: "url(https://example.com/font)",
        },
      },
    },
    {
      typography: {
        ...DEFAULT_APPEARANCE.typography,
        body: { ...DEFAULT_APPEARANCE.typography.body, font: "toString" },
      },
    },
    {
      typography: {
        ...DEFAULT_APPEARANCE.typography,
        body: { ...DEFAULT_APPEARANCE.typography.body, color: "#ffffff" },
      },
    },
    {
      typography: {
        ...DEFAULT_APPEARANCE.typography,
        body: { ...DEFAULT_APPEARANCE.typography.body, lineHeight: NaN },
      },
    },
  ]) {
    const before = structuredClone(draft);
    assert.equal(
      updateAppearance(draft, {
        ...structuredClone(DEFAULT_APPEARANCE),
        ...patch,
      }).ok,
      false,
    );
    assert.deepEqual(draft, before);
  }
});
test("presets validate, reset is isolated and extra styling fields are discarded", () => {
  for (const name of ["compact", "balanced", "spacious"]) {
    const preset = appearancePreset(name);
    assert.equal(updateAppearance(draft, preset).ok, true);
    preset.typography.body.font = "Arial";
    assert.equal(DEFAULT_APPEARANCE.typography.body.font, "Georgia");
  }
  const result = updateAppearance(draft, {
    ...DEFAULT_APPEARANCE,
    css: "background:url(secret)",
    typography: {
      ...DEFAULT_APPEARANCE.typography,
      body: { ...DEFAULT_APPEARANCE.typography.body, arbitrary: "unsafe" },
    },
  });
  assert.deepEqual(result.draft.appearance, DEFAULT_APPEARANCE);
  const vars = appearanceVariables(result.draft.appearance);
  assert.equal(vars["--paper-body-size"], "14px");
  assert.equal(
    Object.values(vars).some((value) => value.includes("url(")),
    false,
  );
});
