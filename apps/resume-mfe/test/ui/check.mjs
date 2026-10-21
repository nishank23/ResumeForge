/* Run against actual source components with synthetic APIs; no production credentials or AI calls. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { serveResumeUx } from "./serve.mjs";
const index = process.argv.indexOf("--browser-helper");
if (index < 0 || !process.argv[index + 1])
  throw new Error(
    "Pass --browser-helper /absolute/path/to/design-taste-frontend/scripts/lib/cdp.mjs",
  );
const { Browser } = await import(
  pathToFileURL(resolve(process.argv[index + 1])).href
);
const out = resolve(
  fileURLToPath(
    new URL("../../../../.local/ux-ui-improvment/", import.meta.url),
  ),
);
mkdirSync(out, { recursive: true });
const fixtureFile = resolve(out, "synthetic-import.txt");
writeFileSync(
  fixtureFile,
  "Morgan Example\nBackend developer building Python APIs.\nSynthetic browser fixture only.",
);
const { server, url } = await serveResumeUx();
const browser = await Browser.launch();
const results = [];
let lastPage;
const wait = async (page, expression) => {
  for (let n = 0; n < 120; n++) {
    if (await page.eval(expression)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("UI did not settle: " + expression);
};
const check = async (page, name, expression) => {
  const result = await page.eval(expression);
  assert.ok(result, name);
  results.push(name);
};
const click = async (page, text) => {
  const expr = `(()=>{const scope=[...document.querySelectorAll('[role=dialog]')].at(-1)??document;const button=[...scope.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(text)}&&el.getClientRects().length);return button&&!button.disabled})()`;
  await wait(page, expr);
  await page.eval((value) => {
    const scope =
      [...document.querySelectorAll("[role=dialog]")].at(-1) ?? document;
    const button = [...scope.querySelectorAll("button")].find(
      (el) => el.textContent.trim() === value && el.getClientRects().length,
    );
    if (!button) throw new Error("Missing visible button: " + value);
    button.click();
  }, text);
};
const fill = async (page, selector, value) => {
  await page.eval(
    ({ selector, value }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error("Missing field: " + selector);
      const setter = Object.getOwnPropertyDescriptor(
        el.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { selector, value },
  );
  await page.eval("new Promise(requestAnimationFrame)");
};
const editSummary = async (page, text) => {
  await wait(
    page,
    () =>
      !!document.querySelector(
        '[aria-label="Professional summary on resume page"]',
      ),
  );
  await page.eval(() => {
    const el = document.querySelector(
      '[aria-label="Professional summary on resume page"]',
    );
    if (!el) throw new Error("Missing editable summary");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await page.send("Input.insertText", { text });
  await page.eval("document.activeElement.blur()");
  await page.eval("new Promise(requestAnimationFrame)");
};
const open = async (query = "", width = 1440, height = 1000) => {
  const page = await browser.newPage({
    width,
    height,
    mobile: width < 600,
    reducedMotion: true,
  });
  lastPage = page;
  await page.goto(url + query, { settleMs: 350 });
  await wait(
    page,
    '!!window.__resumeUx && !!document.querySelector(".rf-ux-workspace, [role=dialog], .rf-resume-library")',
  );
  return page;
};
const events = (name) =>
  `window.__resumeUx.events.filter(e=>e.name===${JSON.stringify(name)})`;
try {
  for (const [width, height] of [
    [1440, 800],
    [768, 1024],
    [390, 844],
  ]) {
    const page = await open("", width, height);
    await wait(page, '!!document.querySelector(".rf-paper-stage")');
    await check(
      page,
      `${width}: editor fits viewport`,
      "document.documentElement.scrollWidth<=innerWidth",
    );
    await check(
      page,
      `${width}: writing starts without sidebars or feedback`,
      '!document.querySelector(".rf-editor-tool-panel, .rf-section-navigation, .rf-priority-check")',
    );
    await check(
      page,
      `${width}: only three task choices`,
      '[...document.querySelectorAll(".rf-rail-tabs button")].map(b=>b.textContent.trim()).join(",")==="Write,Improve,Design"',
    );
    await check(
      page,
      `${width}: initial toolbar never overlays document`,
      '!document.querySelector(".rf-floating-actions")',
    );
    if (width < 901) {
      await check(
        page,
        `${width}: tailoring stays in reach`,
        '(()=>{const r=document.querySelector(".rf-direct-tailor").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()',
      );
    }
    if (width <= 768) {
      await wait(
        page,
        () =>
          !!document.querySelector(
            '[aria-label="Professional summary on resume page"]',
          ),
      );
      await check(
        page,
        `${width}: editing text remains readable`,
        () =>
          Number.parseFloat(
            getComputedStyle(
              document.querySelector(
                '[aria-label="Professional summary on resume page"]',
              ),
            ).fontSize,
          ) >= 16,
      );
    }
    await page.screenshot({
      path: resolve(out, `editor-${width}.jpg`),
      quality: 88,
    });
    await click(page, "Improve");
    await wait(
      page,
      'document.querySelectorAll(".rf-priority-check").length===1',
    );
    await check(
      page,
      `${width}: detailed checks start collapsed`,
      '!document.querySelector(".rf-all-checks").open && !document.querySelector(".rf-readiness-summary").open',
    );
    const firstPriority = await page.eval(
      'document.querySelector(".rf-priority-check h4").textContent',
    );
    await click(page, "Next");
    await check(
      page,
      `${width}: next priority replaces rather than stacks controls`,
      'document.querySelectorAll(".rf-priority-check").length===1 && document.querySelector(".rf-priority-check h4").textContent!==' +
        JSON.stringify(firstPriority),
    );
    await click(page, "Previous");
    await check(
      page,
      `${width}: returning preserves priority order`,
      'document.querySelector(".rf-priority-check h4").textContent===' +
        JSON.stringify(firstPriority),
    );
    await page.screenshot({
      path: resolve(out, `improve-${width}.jpg`),
      quality: 88,
    });
    if (width < 901) {
      await check(
        page,
        `${width}: feedback has one scrolling surface`,
        'getComputedStyle(document.querySelector(".rf-paper-stage")).display==="none" && getComputedStyle(document.querySelector(".rf-editor-tool-panel")).maxHeight==="none"',
      );
      await page.screenshot({
        path: resolve(out, `feedback-${width}.jpg`),
        quality: 88,
      });
    }
    await page.eval(
      'document.querySelector(".rf-priority-check button").click()',
    );
    await wait(page, '!!document.querySelector("[role=dialog]")');
    await check(
      page,
      `${width}: feedback opens scoped editor`,
      '!!document.querySelector("[role=dialog] input, [role=dialog] [contenteditable]")',
    );
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
    });
    await wait(page, '!document.querySelector("[role=dialog]")');
    await check(
      page,
      `${width}: closing an edit returns to feedback`,
      'document.querySelector(".rf-ux-workspace").dataset.mobileView==="tools" && !!document.querySelector(".rf-priority-check")',
    );
    await click(page, "Write");
    await click(page, "Design");
    await check(
      page,
      `${width}: design replaces feedback`,
      '!!document.querySelector(".rf-design-tools") && !document.querySelector(".rf-assessment-feedback") && document.querySelectorAll(".rf-editor-tool-panel").length===1',
    );
    await click(page, "Write");
    await click(page, "Manage sections");
    await check(
      page,
      `${width}: section controls only appear when requested`,
      '!!document.querySelector(".rf-content-tools") && !document.querySelector(".rf-design-tools")',
    );
    await page.eval(() =>
      document
        .querySelector('[aria-label="Close tools and return to resume"]')
        .click(),
    );
    await page.eval("new Promise(requestAnimationFrame)");
    await check(
      page,
      `${width}: closing tools restores writing and keyboard focus`,
      '!document.querySelector(".rf-editor-tool-panel") && document.activeElement.hasAttribute("data-editor-write")',
    );
    await click(page, "Preview");
    await check(
      page,
      `${width}: preview is read only`,
      () =>
        document.querySelector(".rf-paper-stage").dataset.editorMode ===
          "preview" &&
        !document.querySelector('.rf-paper-stage [contenteditable="true"]'),
    );
    await click(page, "Back to writing");
    await click(page, "Tailor for a job");
    await wait(page, '!!document.querySelector(".rf-tailoring-job")');
    await check(
      page,
      `${width}: only three tailoring phases`,
      'document.querySelectorAll(".rf-tailoring-stages button").length===3',
    );
    await check(
      page,
      `${width}: one visible generation action`,
      '[...document.querySelectorAll("button")].filter(b=>b.textContent.trim()==="Tailor my resume"&&b.getClientRects().length).length===1',
    );
    await check(
      page,
      `${width}: phase labels have no circular text containers`,
      () =>
        [
          ...document.querySelectorAll(".rf-tailoring-stages button span"),
        ].every((el) => getComputedStyle(el).borderRadius !== "50%"),
    );
    await check(
      page,
      `${width}: dialog body does not scroll as a whole`,
      () => {
        const el = document.querySelector(".rf-ai-dialog-body");
        return el.scrollHeight <= el.clientHeight + 1;
      },
    );
    if (width > 1000) {
      await check(
        page,
        `${width}: source resume visible beside job input`,
        () => {
          const preview = document
            .querySelector(".rf-tailoring-preview")
            .getBoundingClientRect();
          const input = document
            .querySelector(".rf-tailoring-job")
            .getBoundingClientRect();
          return (
            preview.top < 220 &&
            preview.left >= input.right &&
            preview.bottom <= innerHeight
          );
        },
      );
    } else {
      await click(page, "Preview");
      await check(
        page,
        `${width}: job input can switch to source resume`,
        () =>
          getComputedStyle(document.querySelector(".rf-tailoring-controls"))
            .display === "none" &&
          document.querySelector(".rf-tailoring-preview").getClientRects()
            .length > 0,
      );
      await click(page, "Job details");
    }
    await page.screenshot({
      path: resolve(out, `tailor-job-${width}.jpg`),
      quality: 88,
    });
    await fill(
      page,
      '[aria-label="Target job description"]',
      "Backend Engineer: build Python APIs and PostgreSQL services; write automated tests using pytest.",
    );
    await click(page, "Tailor my resume");
    await wait(page, '!!document.querySelector(".rf-tailoring-review")');
    await check(
      page,
      `${width}: saved facts do not require empty confirmation`,
      events("start") +
        ".length===1 && " +
        events("start") +
        "[0].facts.length===0",
    );
    await check(
      page,
      `${width}: review fits viewport`,
      "document.documentElement.scrollWidth<=innerWidth",
    );
    await check(page, `${width}: save action stays on screen`, () => {
      const rect = document
        .querySelector(".rf-ai-dialog-footer button:last-child")
        .getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    });
    if (width > 1000) {
      await check(
        page,
        `${width}: resume stays visible while reviewing lower details`,
        () => {
          const preview = document.querySelector(".rf-tailoring-preview");
          const top = preview.getBoundingClientRect().top;
          document.querySelector(".rf-tailoring-check-details").open = true;
          const panel = document.querySelector(".rf-tailoring-controls");
          panel.scrollTop = panel.scrollHeight;
          return (
            panel.scrollTop > 0 &&
            Math.abs(preview.getBoundingClientRect().top - top) < 1 &&
            preview.getBoundingClientRect().top < 220
          );
        },
      );
      await page.eval(() => {
        document.querySelector(".rf-tailoring-check-details").open = false;
        document.querySelector(".rf-tailoring-controls").scrollTop = 0;
      });
    }
    await page.screenshot({
      path: resolve(out, `tailor-review-${width}.jpg`),
      quality: 88,
    });
    await page.eval(
      'document.querySelector(".rf-tailoring-proposal input[type=checkbox]").click()',
    );
    await check(
      page,
      `${width}: rejected change restores exact source`,
      'document.querySelector(".rf-tailoring-preview").textContent.includes("Backend developer building Python APIs and SQL data services.")',
    );
    if (width < 1001) {
      await click(page, "Preview");
      await check(
        page,
        `${width}: preview replaces changes`,
        'getComputedStyle(document.querySelector(".rf-tailoring-changes")).display==="none"',
      );
      await click(page, "Changes");
    }
    await page.eval("window.__resumeUx.pdfFails=true");
    await click(page, "Save copy & download PDF");
    await wait(page, '!!document.querySelector(".rf-tailoring-ready")');
    await check(
      page,
      `${width}: copy retained after PDF error`,
      events("apply") +
        '.length===1 && document.querySelector(".rf-tailoring-ready").textContent.includes("already saved")',
    );
    await page.eval("window.__resumeUx.pdfFails=false");
    await click(page, "Download PDF");
    await wait(page, events("copyPdf") + ".length===2");
    await check(
      page,
      `${width}: PDF retry does not duplicate copy`,
      events("apply") + ".length===1",
    );
    await check(
      page,
      `${width}: source unchanged by reviewed copy`,
      'window.__resumeUx.latest.sections.find(s=>s.kind==="summary").summary.content[0].content[0].text==="Backend developer building Python APIs and SQL data services."',
    );
    await check(
      page,
      `${width}: no component runtime errors`,
      JSON.stringify(page.consoleErrors.length === 0),
    );
    await page.close();
  }
  let page = await open();
  await wait(page, '!!document.querySelector(".rf-paper-stage")');
  await editSummary(
    page,
    "Backend developer building Python APIs with PostgreSQL and automated pytest checks.",
  );
  await click(page, "Design");
  await click(page, "Improve");
  await click(page, "Write");
  await check(
    page,
    "changing tasks preserves unsaved resume edits",
    () =>
      document
        .querySelector('[aria-label="Professional summary on resume page"]')
        .textContent.includes("automated pytest checks") &&
      !!document.querySelector(".rf-explicit-save"),
  );
  await click(page, "Save & download");
  await wait(page, events("pdf") + ".length===1");
  await check(
    page,
    "save and PDF bind the new revision",
    events("saveComplete") +
      "[0].version===2 && " +
      events("pdf") +
      "[0].version===2",
  );
  await page.close();
  page = await open();
  await editSummary(
    page,
    "Backend developer building Python API services with automated checks.",
  );
  await page.eval("window.__resumeUx.saveFails=true");
  await click(page, "Save & download");
  await wait(page, 'document.body.innerText.includes("newer version")');
  await check(
    page,
    "revision conflict never exports an old PDF",
    events("pdf") +
      '.length===0 && document.body.innerText.includes("Backend developer building Python API services with automated checks.")',
  );
  await page.close();
  page = await open();
  await editSummary(
    page,
    "Backend developer building Python API services with automated checks.",
  );
  await click(page, "Save & tailor");
  await wait(page, '!!document.querySelector(".rf-tailoring-job")');
  await fill(
    page,
    '[aria-label="Target job description"]',
    "Backend Engineer: build Python APIs and PostgreSQL services; write automated tests using pytest.",
  );
  await click(page, "Tailor my resume");
  await wait(page, events("start") + ".length===1");
  await check(
    page,
    "save and tailor use updated callbacks",
    events("start") + "[0].version===2",
  );
  await page.close();
  page = await open();
  await editSummary(page, "First edits to Python API summary before saving.");
  await page.eval("window.__resumeUx.delaySave=true");
  await click(page, "Save & tailor");
  await wait(page, "!!window.__resumeUx.resolveSave");
  await editSummary(
    page,
    "Newer edits made while the previous version is saving.",
  );
  await page.eval("window.__resumeUx.resolveSave()");
  await wait(
    page,
    'document.body.innerText.includes("draft changed while saving")',
  );
  await check(
    page,
    "edits made during save never enter a stale tailoring request",
    '!document.querySelector(".rf-tailoring-dialog") && ' +
      events("start") +
      ".length===0",
  );
  await page.close();
  page = await open();
  await editSummary(
    page,
    "Python API summary with new testing details before saving.",
  );
  await page.eval("window.__resumeUx.delaySave=true");
  await click(page, "Save & tailor");
  await wait(page, "!!window.__resumeUx.resolveSave");
  await page.eval(() =>
    document
      .querySelector('[aria-label="Edit resume title and contact details"]')
      .click(),
  );
  await wait(page, '!!document.querySelector("[role=dialog]")');
  await page.eval("window.__resumeUx.resolveSave()");
  await wait(page, events("saveComplete") + ".length===1");
  await page.eval("new Promise(requestAnimationFrame)");
  await check(
    page,
    "new edit dialog during save blocks automatic tailoring",
    '!document.querySelector(".rf-tailoring-dialog") && !!document.querySelector("[role=dialog]")',
  );
  await page.close();
  page = await open("", 390, 844);
  await wait(
    page,
    () => !!document.querySelector(".rf-mobile-document .tiptap"),
  );
  await click(page, "Preview");
  await check(
    page,
    "phone preview retains A4 layout",
    '!!document.querySelector(".rf-page-zoom-surface") && !document.querySelector(".rf-mobile-document")',
  );
  await click(page, "Back to writing");
  await check(
    page,
    "phone editing never persists display typography",
    '!!document.querySelector(".rf-mobile-document") && window.__resumeUx.latest.appearance===undefined',
  );
  await page.close();
  page = await open("?view=tailoring");
  await page.eval('document.querySelector(".rf-tailoring-optional").open=true');
  await wait(page, '!!document.querySelector("#experience-answer")');
  await fill(
    page,
    "#experience-answer",
    "Implemented server-side validation in Python for invalid invoices.",
  );
  await check(
    page,
    "additional facts block start until confirmed",
    'document.querySelector(".rf-ai-dialog-footer button:last-child").disabled',
  );
  await page.eval(
    'document.querySelector(".rf-experience-confirm input").click()',
  );
  await click(page, "Tailor my resume");
  await wait(page, events("start") + ".length===1");
  await check(
    page,
    "added facts retain explicit confirmation and original entry",
    events("start") +
      "[0].facts[0].confirmed===true && " +
      events("start") +
      '[0].facts[0].itemId==="backend-role"',
  );
  await page.close();
  for (const scenario of ["stale", "expired"]) {
    page = await open("?view=tailoring&case=" + scenario);
    await wait(page, '!!document.querySelector(".rf-tailoring-review")');
    await check(
      page,
      scenario + " proposals cannot be saved",
      'document.querySelector(".rf-ai-dialog-footer button:last-child").disabled',
    );
    await page.close();
  }
  page = await open("?view=tailoring");
  await page.eval("window.__resumeUx.preflightStale=true");
  await click(page, "Tailor my resume");
  await wait(page, 'document.body.innerText.includes("saved version changed")');
  await check(
    page,
    "stale preflight stops provider submission",
    events("start") + ".length===0",
  );
  await page.close();
  page = await open("?view=tailoring");
  await page.eval("window.__resumeUx.providerFails=true");
  await click(page, "Tailor my resume");
  await wait(page, 'document.body.innerText.includes("Provider unavailable")');
  await check(
    page,
    "provider failure keeps original and creates no copy",
    events("apply") + ".length===0",
  );
  await page.eval("window.__resumeUx.providerFails=false");
  await click(page, "Tailor my resume");
  await wait(page, events("start") + ".length===2");
  await check(
    page,
    "start retry reuses its idempotency key",
    events("start") + "[0].id===" + events("start") + "[1].id",
  );
  await page.close();
  page = await open("?case=queued");
  await click(page, "Tailor for a job");
  await wait(
    page,
    'document.body.innerText.includes("processing stages complete")',
  );
  await click(page, "Close and continue later");
  await wait(page, '!document.querySelector(".rf-tailoring-dialog")');
  await click(page, "Tailor for a job");
  await wait(
    page,
    'document.body.innerText.includes("processing stages complete")',
  );
  await check(
    page,
    "queued work resumes without another request",
    events("start") + ".length===0",
  );
  await click(page, "Cancel tailoring");
  await wait(page, 'document.body.innerText.includes("Tailoring cancelled")');
  await check(
    page,
    "cancellation preserves source and creates no copy",
    events("cancel") + ".length===1 && " + events("apply") + ".length===0",
  );
  await page.close();
  page = await open("?view=tailoring&case=empty");
  await wait(
    page,
    'document.body.innerText.includes("No supported changes were needed")',
  );
  await check(
    page,
    "empty result still permits a separate copy",
    '!document.querySelector(".rf-ai-dialog-footer button:last-child").disabled',
  );
  await page.close();
  page = await open("?view=tailoring&case=saved");
  await wait(page, '!!document.querySelector(".rf-tailoring-ready")');
  await click(page, "Download PDF");
  await wait(page, events("copyPdf") + ".length===1");
  await check(
    page,
    "reopened saved copy exports without another generation or Apply",
    events("start") + ".length===0 && " + events("apply") + ".length===0",
  );
  await page.close();
  for (const width of [1366, 1024, 768, 390]) {
    page = await open("?view=library&long-title", width, 800);
    await wait(page, '!!document.querySelector(".rf-library-name")');
    await check(
      page,
      `${width}: library text action contains its label and cannot overlap icons`,
      () => {
        const buttons = [
          ...document.querySelectorAll(".rf-library-row-actions button"),
        ];
        const first = buttons[0],
          next = buttons[1];
        const a = first.getBoundingClientRect(),
          b = next.getBoundingClientRect();
        return (
          first.scrollWidth <= first.clientWidth + 1 &&
          (a.right <= b.left || a.bottom <= b.top) &&
          document.documentElement.scrollWidth <= innerWidth
        );
      },
    );
    await page.screenshot({
      path: resolve(out, `library-actions-${width}.jpg`),
      quality: 88,
    });
    await page.close();
  }
  page = await open("?view=tailoring&case=multiple", 1366, 768);
  await wait(
    page,
    () => !!document.querySelector("[aria-label='Choose suggestion']"),
  );
  await check(
    page,
    "review shows one suggestion while keeping all choices",
    () =>
      document.querySelectorAll(".rf-tailoring-proposal").length === 1 &&
      document.querySelector("[aria-label='Choose suggestion']").options
        .length === 2,
  );
  await page.eval(() =>
    document
      .querySelector(".rf-tailoring-proposal input[type=checkbox]")
      .click(),
  );
  await page.eval(() =>
    document.querySelector("[aria-label='Next suggestion']").click(),
  );
  await wait(
    page,
    'document.querySelector(".rf-tailoring-proposal").textContent.includes("Backend Developer")',
  );
  await check(
    page,
    "next suggestion preserves unseen choice and source preview",
    () =>
      document.querySelector(".rf-tailoring-proposal input").checked &&
      document
        .querySelector(".rf-tailoring-preview")
        .textContent.includes(
          "Backend developer building Python APIs and SQL data services.",
        ),
  );
  await page.eval(() =>
    document.querySelector("[aria-label='Previous suggestion']").click(),
  );
  await wait(
    page,
    'document.querySelector(".rf-tailoring-proposal").textContent.includes("Use suggestion: Summary")',
  );
  await check(
    page,
    "returning to suggestion preserves rejection",
    () => !document.querySelector(".rf-tailoring-proposal input").checked,
  );
  await page.eval(
    () =>
      (document.querySelector("[aria-label='Choose suggestion']").value = "1"),
  );
  await page.eval(() =>
    document
      .querySelector("[aria-label='Choose suggestion']")
      .dispatchEvent(new Event("change", { bubbles: true })),
  );
  await wait(
    page,
    'document.querySelector(".rf-tailoring-proposal").textContent.includes("Backend Developer")',
  );
  await page.screenshot({
    path: resolve(out, "tailor-multiple-1366.jpg"),
    quality: 88,
  });
  await click(page, "Save copy & download PDF");
  await wait(page, '!!document.querySelector(".rf-tailoring-ready")');
  await check(
    page,
    "save uses all review choices after navigation",
    events("apply") +
      "[0].selected.length===1 && " +
      events("apply") +
      '[0].selected[0]==="role-change"',
  );
  await page.close();
  page = await open("?view=library");
  await wait(page, '!!document.querySelector(".rf-library-name")');
  await click(page, "Tailor for a job");
  await check(
    page,
    "library deep link opens direct tailoring",
    events("navigate") + '[0].path.endsWith("?action=tailor")',
  );
  await page.close();
  page = await open("?view=library");
  await wait(page, '!!document.querySelector(".rf-library-name")');
  await click(page, "Start from scratch");
  await wait(page, events("create") + ".length===1");
  await check(
    page,
    "blank creation requires no profile or template step",
    events("navigate") + ".length===1",
  );
  await page.close();
  page = await open("?view=import", 390, 844);
  const { root } = await page.send("DOM.getDocument");
  const { nodeId } = await page.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "input[type=file]",
  });
  await page.send("DOM.setFileInputFiles", { nodeId, files: [fixtureFile] });
  await wait(page, '!!document.querySelector(".rf-import-fullpage")');
  await wait(
    page,
    () =>
      !!document.querySelector(
        '[aria-label="Professional summary on resume page"]',
      ),
  );
  await check(
    page,
    "import review is full-page and unsaved",
    '!document.querySelector("[role=dialog]") && ' +
      events("createImport") +
      ".length===0",
  );
  await page.screenshot({ path: resolve(out, "import-390.jpg"), quality: 88 });
  await click(page, "Discard upload");
  await wait(page, '!!document.querySelector("[role=dialog]")');
  await click(page, "Keep reviewing");
  await check(
    page,
    "cancel discard preserves staged import",
    '!!document.querySelector(".rf-import-fullpage") && ' +
      events("createImport") +
      ".length===0",
  );
  await click(page, "Confirm import");
  await wait(page, events("createImport") + ".length===1");
  await check(
    page,
    "explicit import confirmation persists once",
    events("navigate") + ".length===1",
  );
  await page.close();
  page = await open("?theme=light", 1440, 1000);
  await wait(page, '!!document.querySelector(".rf-paper-stage")');
  await page.screenshot({
    path: resolve(out, "editor-light-1440.jpg"),
    quality: 88,
  });
  await check(
    page,
    "light theme uses real Studio tokens",
    'getComputedStyle(document.documentElement).getPropertyValue("--background").trim()==="#f5f3f8"',
  );
  await page.close();
  writeFileSync(
    resolve(out, "browser-results.json"),
    JSON.stringify(
      {
        scope:
          "Actual React components with isolated synthetic API fixtures. No live provider or database calls.",
        passed: results.length,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: results.length, out }));
} catch (error) {
  writeFileSync(resolve(out, "browser-failure.txt"), String(error.stack));
  if (lastPage) {
    console.log(
      JSON.stringify(
        await lastPage.eval(
          "({text:document.body.innerText,events:window.__resumeUx?.events})",
        ),
      ),
    );
    await lastPage
      .screenshot({ path: resolve(out, "browser-failure.jpg"), quality: 85 })
      .catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
  await server.close();
}
