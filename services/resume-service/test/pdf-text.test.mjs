import test from "node:test";
import assert from "node:assert/strict";
import { pdfPageText } from "../dist/pdf-text.js";
const fragment = (str, x, y, width, height = 10) => ({
  str,
  width,
  height,
  transform: [1, 0, 0, 1, x, y],
});
test("visual rows join small-cap glyphs and retain metadata columns despite drawing order", () => {
  const items = [
    fragment("2021 – Present", 420, 700, 80),
    fragment("EXPERIENCES", 85, 740, 70),
    fragment("A", 50, 780, 8, 16),
    fragment("L", 58, 780, 6, 13),
    fragment("E", 64, 780, 7, 13),
    fragment("X", 71, 780, 8, 13),
    fragment("STONE", 88, 780, 42, 16),
    fragment("WORK", 50, 740, 30),
    fragment("Engineer", 50, 701.5, 50),
    fragment("Wrapped continuation.", 50, 660, 130),
    fragment("Built a dashboard with", 50, 680, 125),
  ];
  assert.equal(
    pdfPageText(items, []),
    "ALEX STONE\nWORK EXPERIENCES\nEngineer\t2021 – Present\nBuilt a dashboard with\nWrapped continuation.",
  );
});
test("annotation destinations survive username-only links without following unsafe destinations", () => {
  const items = [
    fragment("alex-profile", 50, 100, 60),
    fragment("https://example.com/alex", 50, 70, 140),
  ];
  const annotations = [
    {
      url: "https://www.linkedin.com/in/alex-profile",
      rect: [50, 98, 110, 110],
    },
    { url: "https://example.com/alex", rect: [50, 68, 190, 80] },
    { url: "javascript:alert(1)", rect: [50, 98, 110, 110] },
    { url: "mailto:alex@example.com", rect: [50, 98, 110, 110] },
    { url: "https://example.com/bad", rect: [50, NaN, 110, 110] },
  ];
  const text = pdfPageText(items, annotations);
  assert.match(
    text,
    /alex-profile https:\/\/www.linkedin.com\/in\/alex-profile/,
  );
  assert.equal(text.split("https://example.com/alex").length - 1, 1);
  assert.doesNotMatch(text, /javascript|mailto|\/bad/);
});
