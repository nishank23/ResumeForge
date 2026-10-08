import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderResumePdf } from "../dist/resume-pdf-template.js";
import { renderSavedResumePdf } from "../dist/pdf.js";
import { loadResumeApi } from "../../../apps/resume-mfe/test/resume-api-loader.mjs";
const { blankResume, fromResumeContent } = await loadResumeApi();
function draft() {
  const d = blankResume("Zoë García");
  d.header.headline = "Engineer | Data systems";
  d.header.links = [
    { id: "site", label: "Website", url: "https://example.invalid/portfolio" },
  ];
  d.sampleContact = {
    email: "synthetic@example.invalid",
    phone: "+1 555 0100",
  };
  d.sections[0].summary = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Supported summary fact.",
            marks: [{ type: "bold" }],
          },
        ],
      },
    ],
  };
  const imported = fromResumeContent({
    sections: [
      {
        id: "work",
        kind: "experience",
        label: "Experience",
        entries: [
          {
            id: "job",
            title: "Engineer",
            subtitle: "Synthetic Company",
            startDate: "2024-02",
            endDate: "2026-04",
            technologies: "TypeScript, PostgreSQL",
            bullets: [
              {
                id: "visible",
                text: "Improved supported workflow by 20%.",
                hidden: false,
              },
              { id: "hidden", text: "HIDDEN BULLET", hidden: true },
            ],
          },
        ],
      },
    ],
  });
  d.sections[1].entries = imported.sections[0].entries;
  d.sections[3].hidden = true;
  d.sections[3].summary = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "HIDDEN SECTION" }],
      },
    ],
  };
  d.sections[4].languages = [
    { id: "spanish", text: "Spanish", proficiency: "Native", hidden: false },
    { id: "secret", text: "HIDDEN LANGUAGE", proficiency: "", hidden: true },
  ];
  return d;
}
async function inspect(bytes) {
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const content = await p.getTextContent();
    const text = content.items
      .filter((i) => "str" in i)
      .map((i) => i.str)
      .join(" ");
    assert.ok(text.trim(), "no empty pages");
    assert.ok(
      Math.abs(p.view[2] - 595.28) < 1 && Math.abs(p.view[3] - 841.89) < 1,
      "A4",
    );
    for (const item of content.items.filter(
      (i) => "str" in i && i.str.trim(),
    )) {
      assert.ok(
        item.transform[4] >= 0 &&
          item.transform[5] >= 0 &&
          item.transform[5] <= p.view[3],
        "text within page",
      );
    }
    if (n === 1) {
      const name = content.items.find(
        (i) => "str" in i && i.str.includes("Zoë"),
      );
      const headline = content.items.find(
        (i) => "str" in i && i.str.includes("Engineer | Data"),
      );
      assert.ok(name && headline);
      assert.ok(
        name.transform[5] > headline.transform[5] + 10,
        "name and headline do not overlap",
      );
    }
    pages.push(text);
  }
  const links = await (await doc.getPage(1)).getAnnotations();
  await doc.destroy();
  return { pages, links };
}
test("selectable A4 PDF preserves supported facts, accents and links; excludes hidden content and empty sections", async () => {
  const bytes = await renderSavedResumePdf(draft());
  const { pages, links } = await inspect(bytes);
  assert.equal(pages.length, 1);
  const text = pages.join(" ");
  for (const fact of [
    "Zoë García",
    "synthetic@example.invalid",
    "Supported summary fact.",
    "Synthetic Company",
    "Feb 2024",
    "Apr 2026",
    "TypeScript, PostgreSQL",
    "20%",
    "Spanish - Native",
  ])
    assert.ok(text.includes(fact), fact);
  for (const excluded of [
    "HIDDEN",
    "EDUCATION",
    "PROJECTS",
    "Improve with AI",
    "Click to edit",
    "Raw extracted",
  ])
    assert.ok(!text.includes(excluded), excluded);
  assert.ok(links.some((l) => l.url === "https://example.invalid/portfolio"));
  await writeFile("/tmp/forge-synthetic-export.pdf", bytes);
});
test("long supported content paginates with every first/last fact retained and no blank pages", async () => {
  const d = draft();
  d.sections[1].entries[0].bullets = Array.from({ length: 100 }, (_, i) => ({
    id: `long-${i}`,
    text: `Fact ${i}: Supported long wording for a real job description, with several specific systems and technologies.`,
    hidden: false,
  }));
  const bytes = await renderResumePdf(d);
  const { pages } = await inspect(bytes);
  assert.ok(pages.length > 1);
  const text = pages.join(" ");
  for (let i = 0; i < 100; i++)
    assert.ok(text.includes(`Fact ${i}:`), `fact ${i}`);
  await writeFile("/tmp/forge-long-export.pdf", bytes);
});
test("unsupported characters and unsafe links fail visibly rather than producing missing facts or fetching URLs", async () => {
  const d = draft();
  d.header.firstName = "🦄";
  await assert.rejects(renderResumePdf(d), /pdf_unsupported_characters/);
  const invalid = draft();
  invalid.header.links[0].url = "file:///private/secret";
  await assert.rejects(renderResumePdf(invalid));
});
