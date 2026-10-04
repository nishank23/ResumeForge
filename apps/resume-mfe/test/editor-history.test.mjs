import assert from "node:assert/strict";
import test from "node:test";
import {
  createHistory,
  editorHistory,
  isDirty,
} from "../src/editor-history.ts";
import {
  normalizeSummary,
  summaryFromText,
} from "../../../packages/shared/src/components/ui/summary-document.ts";

test("edits from two surfaces share history; branching clears redo", () => {
  const initial = summaryFromText("Original summary");
  let state = createHistory(initial);
  state = editorHistory(state, {
    type: "edit",
    value: summaryFromText("Panel edit"),
  });
  state = editorHistory(state, {
    type: "edit",
    value: summaryFromText("Page edit"),
  });
  state = editorHistory(state, { type: "undo" });
  assert.deepEqual(state.current, summaryFromText("Panel edit"));
  state = editorHistory(state, { type: "redo" });
  assert.deepEqual(state.current, summaryFromText("Page edit"));
  state = editorHistory(state, { type: "undo" });
  state = editorHistory(state, {
    type: "edit",
    value: summaryFromText("Different edit"),
  });
  assert.equal(state.future.length, 0);
  assert.deepEqual(initial, summaryFromText("Original summary"));
});

test("Save checkpoints rich text; Cancel restores it and can itself be undone", () => {
  const rich = normalizeSummary({
    type: "doc",
    content: [
      {
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
                    text: "Résumé 日本語",
                    marks: [{ type: "bold" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  let state = createHistory(summaryFromText("Initial"));
  state = editorHistory(state, { type: "edit", value: rich });
  assert.equal(isDirty(state), true);
  state = editorHistory(state, { type: "save" });
  assert.equal(isDirty(state), false);
  state = editorHistory(state, {
    type: "edit",
    value: summaryFromText("Unwanted change"),
  });
  state = editorHistory(state, { type: "cancel" });
  assert.deepEqual(state.current, rich);
  assert.equal(isDirty(state), false);
  state = editorHistory(state, { type: "undo" });
  assert.deepEqual(state.current, summaryFromText("Unwanted change"));
  assert.equal(isDirty(state), true);
  assert.deepEqual(
    createHistory(summaryFromText("Initial")).current,
    summaryFromText("Initial"),
  );
});

test("normalization discards executable attributes, unknown nodes and link marks", () => {
  const result = normalizeSummary({
    type: "doc",
    attrs: { contact: "private" },
    content: [
      {
        type: "paragraph",
        attrs: { onclick: "unsafe" },
        content: [
          {
            type: "text",
            text: "Supported",
            marks: [
              { type: "link", attrs: { href: "javascript:unsafe" } },
              { type: "italic" },
            ],
          },
          { type: "image", attrs: { src: "private" } },
          { type: "hardBreak" },
        ],
      },
      { type: "script", text: "unsafe" },
    ],
  });
  assert.deepEqual(result, {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Supported", marks: [{ type: "italic" }] },
          { type: "hardBreak" },
        ],
      },
    ],
  });
  assert.deepEqual(normalizeSummary(null), summaryFromText(""));
});

test("duplicate synchronization updates do not consume bounded undo history", () => {
  let state = createHistory(summaryFromText("Initial"));
  assert.equal(editorHistory(state, { type: "undo" }), state);
  assert.equal(editorHistory(state, { type: "redo" }), state);
  assert.equal(
    editorHistory(state, { type: "edit", value: summaryFromText("Initial") }),
    state,
  );
  for (let i = 0; i < 120; i++)
    state = editorHistory(state, {
      type: "edit",
      value: summaryFromText(String(i)),
    });
  assert.equal(state.past.length, 100);
});

test("nested bullet text survives synchronization, undo and Cancel", () => {
  const document = {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Parent" }],
              },
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Child fact" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  assert.deepEqual(normalizeSummary(document), document);
  let state = createHistory(document);
  state = editorHistory(state, {
    type: "edit",
    value: summaryFromText("Temporary"),
  });
  state = editorHistory(state, { type: "cancel" });
  assert.deepEqual(state.current, document);
});
