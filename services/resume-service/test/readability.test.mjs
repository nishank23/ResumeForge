import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { comparePdfReadability } from "../dist/pdf-readability.js";
import { inspectPdfBytes } from "../dist/inspect-pdf.js";
import { inspectSavedResumePdf, renderSavedResumePdf } from "../dist/pdf.js";
import { loadResumeApi } from "../../../apps/resume-mfe/test/resume-api-loader.mjs";
const { blankResume, fromResumeContent } = await loadResumeApi();
function fixture() {
  const doc = blankResume("Zoë García");
  doc.header.headline = "Backend engineer";
  doc.header.links = [
    {
      id: "portfolio",
      label: "Portfolio",
      url: "https://example.invalid/never-fetch",
    },
  ];
  doc.sampleContact = {
    email: "synthetic@example.invalid",
    phone: "+1 555 0100",
  };
  const imported = fromResumeContent({
    sections: [
      {
        id: "summary",
        kind: "summary",
        label: "Summary",
        summary: "Built Python APIs and C++ services for operations teams.",
      },
      {
        id: "work",
        kind: "experience",
        label: "Experience",
        entries: [
          {
            id: "role",
            title: "Engineer",
            subtitle: "Demo Systems",
            employmentType: "Full-time",
            location: "Remote",
            grade: "Verified grade",
            startDate: "2022-01",
            endDate: "2024-12",
            description: "Designed PostgreSQL queries with pytest coverage.",
            bullets: [
              {
                id: "visible",
                text: "Improved supported workflow by 20%.",
                hidden: false,
              },
              { id: "hidden", text: "HIDDEN SECRET", hidden: true },
            ],
            technologies: "Python, PostgreSQL",
            links: [
              {
                id: "proof",
                label: "Project notes",
                url: "https://example.invalid/never-fetch-either",
              },
            ],
          },
        ],
      },
      {
        id: "skills",
        kind: "skills",
        label: "Skills",
        groups: [
          {
            id: "tools",
            label: "Tools",
            items: [
              { id: "python", text: "Python", hidden: false },
              { id: "hidden-skill", text: "HIDDEN SKILL", hidden: true },
            ],
          },
        ],
      },
    ],
  });
  doc.sections = imported.sections;
  return doc;
}
const page = (text) => [{ page: 1, text }];
function simple() {
  const doc = blankResume("Morgan Example");
  doc.header.links = [];
  doc.sampleContact = { email: "", phone: "" };
  doc.sections = fromResumeContent({
    sections: [
      {
        id: "summary",
        kind: "summary",
        label: "Summary",
        summary: "First unique statement.\nSecond distinct statement.",
      },
    ],
  }).sections;
  return doc;
}
test("readability accepts recoverable text with Unicode, whitespace and punctuation differences", () => {
  const doc = simple();
  doc.header.firstName = "Zoë";
  doc.header.lastName = "García";
  const result = comparePdfReadability(
    doc,
    page(
      "ZOË GARCÍA\nSUMMARY\nFirst unique statement.\nSecond distinct statement.",
    ),
  );
  assert.equal(result.status, "readable");
  assert.equal(result.issues.length, 0);
  assert.equal(result.checkedBlocks, result.recoveredBlocks);
});
test("missing saved text identifies its section and exact source excerpt", () => {
  const result = comparePdfReadability(
    simple(),
    page("Morgan Example\nSummary\nFirst unique statement."),
  );
  assert.equal(result.status, "needs_review");
  assert.ok(
    result.issues.some(
      (i) =>
        i.kind === "missing_text" &&
        i.sectionId === "summary" &&
        i.excerpts.some((t) => t.includes("Second distinct")),
    ),
  );
});
test("reordered prose is a reading-order issue rather than invented missing qualifications", () => {
  const result = comparePdfReadability(
    simple(),
    page(
      "Morgan Example\nSummary\nSecond distinct statement.\nFirst unique statement.",
    ),
  );
  assert.equal(result.status, "needs_review");
  assert.ok(result.issues.some((i) => i.kind === "reading_order"));
  assert.ok(result.issues.every((i) => i.kind !== "missing_text"));
});
test("repeated saved text needs separate extracted occurrences", () => {
  const doc = simple();
  doc.sections[0].summary.content.push(
    structuredClone(doc.sections[0].summary.content[0]),
  );
  const result = comparePdfReadability(
    doc,
    page(
      "Morgan Example\nSummary\nFirst unique statement.\nSecond distinct statement.",
    ),
  );
  assert.equal(result.status, "needs_review");
  assert.ok(result.issues.some((i) => i.kind === "missing_text"));
});
test("meaningful C++ and percentage symbols cannot disappear silently", () => {
  const doc = simple();
  doc.sections[0].summary.content = [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Built C++ workflows with 20% improvement." },
      ],
    },
  ];
  const result = comparePdfReadability(
    doc,
    page("Morgan Example\nSummary\nBuilt C workflows with 20 improvement."),
  );
  assert.ok(result.issues.some((i) => i.kind === "missing_text"));
});
test("empty extraction reports no readable text, including an empty source", () => {
  for (const doc of [simple(), { ...blankResume(""), sections: [] }]) {
    const result = comparePdfReadability(doc, page(""));
    assert.equal(result.status, "needs_review");
    assert.equal(result.issues[0].kind, "no_text");
  }
});
test("hidden content and empty sections do not become mandatory checks", () => {
  const doc = simple();
  doc.sections[0].hidden = true;
  assert.equal(
    comparePdfReadability(doc, page("Morgan Example")).status,
    "readable",
  );
});
test("real exported PDFs recover visible owner content, links, dates, Unicode and rich text", async () => {
  const result = await inspectSavedResumePdf(fixture());
  assert.equal(result.status, "readable", JSON.stringify(result.issues));
  const text = result.pages.map((p) => p.text).join("\n");
  for (const value of [
    "Zoë",
    "García",
    "synthetic@example.invalid",
    "Portfolio",
    "Project notes",
    "PostgreSQL",
    "20%",
  ])
    assert.ok(text.includes(value), value);
  for (const value of ["HIDDEN SECRET", "HIDDEN SKILL", "never-fetch"])
    assert.ok(!text.includes(value), value);
});
test("rich text marks do not create spaces inside words", async () => {
  const doc = simple();
  doc.sections[0].summary.content = [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Py", marks: [{ type: "bold" }] },
        { type: "text", text: "thon APIs support operations." },
      ],
    },
  ];
  const result = await inspectSavedResumePdf(doc);
  assert.equal(result.status, "readable", JSON.stringify(result.issues));
  assert.ok(result.pages[0].text.includes("Python"));
});
test("multi-page exports retain actual page navigation and ordered text", async () => {
  const doc = fixture();
  const entry = doc.sections[1].entries[0];
  entry.bullets = Array.from({ length: 48 }, (_, i) => ({
    id: `bullet-${i}`,
    text: `Supported achievement number ${i} improves operational reporting through tested Python queries and documented investigation.`,
    hidden: false,
  }));
  const result = await inspectSavedResumePdf(doc);
  assert.ok(result.pages.length > 1);
  assert.equal(result.status, "readable", JSON.stringify(result.issues));
  assert.ok(
    result.pages
      .map((p) => p.text)
      .join("\n")
      .includes("number 47"),
  );
});
test("a textless real PDF never receives a passing result", async () => {
  const bytes = await renderToBuffer(
    h(Document, null, h(Page, { size: "A4" })),
  );
  const result = await inspectPdfBytes(simple(), new Uint8Array(bytes));
  assert.equal(result.status, "needs_review");
  assert.equal(result.issues[0].kind, "no_text");
});
test("exports and readability share a bounded pool; capacity is released after work", async () => {
  const result = await Promise.allSettled([
    inspectSavedResumePdf(simple()),
    renderSavedResumePdf(simple()),
    inspectSavedResumePdf(simple()),
  ]);
  assert.equal(result[0].status, "fulfilled");
  assert.equal(result[1].status, "fulfilled");
  assert.equal(result[2].status, "rejected");
  assert.equal(result[2].reason.code, "resume_unavailable");
  assert.equal((await inspectSavedResumePdf(simple())).status, "readable");
});
test("invalid worker input fails safely without a partial passing report", async () => {
  await assert.rejects(
    inspectSavedResumePdf({ private: "invalid payload" }),
    (error) => error.code === "resume_unavailable",
  );
});
