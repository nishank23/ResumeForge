import test from "node:test";
import assert from "node:assert/strict";
import { wordDiff } from "../src/word-diff.ts";

const restored = (parts, excluded) =>
  parts
    .filter((p) => p.type !== excluded)
    .map((p) => p.text)
    .join("");
function verify(before, after) {
  const parts = wordDiff(before, after);
  assert.equal(restored(parts, "added"), before);
  assert.equal(restored(parts, "removed"), after);
  assert.ok(parts.every((p) => p.text.length));
  return parts;
}
test("separate word replacements keep unchanged technical facts between edits", () => {
  const parts = verify(
    "Built Android apps using Java and integrated auth.",
    "Developed Android applications using Java and integrated authentication.",
  );
  assert.deepEqual(
    parts.filter((p) => p.type === "removed").map((p) => p.text),
    ["Built", "apps", "auth"],
  );
  assert.deepEqual(
    parts.filter((p) => p.type === "added").map((p) => p.text),
    ["Developed", "applications", "authentication"],
  );
  assert.ok(
    parts.some(
      (p) => p.type === "same" && p.text.includes("using Java and integrated"),
    ),
  );
});
test("insertions, removals, punctuation, Unicode, whitespace and multiline edits reconstruct both texts", () => {
  for (const [before, after] of [
    ["", "New text"],
    ["Remove text", ""],
    ["Same text", "Same text"],
    ["Built APIs.", "Built REST APIs."],
    ["in order to build", "to build"],
    ["• Built APIs.\n• Worked  on SQL.", "• Developed APIs.\n• Worked on SQL."],
    ["Développé des API, Java/Kotlin.", "Développé les API : Java/Kotlin."],
  ])
    verify(before, after);
});
test("bounded fallback preserves complete original and suggested long descriptions", () => {
  const before = "Original ".repeat(1200),
    after = "Replacement ".repeat(1200);
  const parts = verify(before, after);
  assert.ok(parts.length <= 4);
});
