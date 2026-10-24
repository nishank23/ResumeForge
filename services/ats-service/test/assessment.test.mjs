import assert from "node:assert/strict";
import test from "node:test";
import {
  atsAssessmentInputSchema,
  atsAssessmentSchema,
  ATS_RUBRIC,
} from "../../../packages/shared-types/dist/index.js";
import { assessEvidence, AtsUnavailable } from "../dist/assessment.js";
import { input, row } from "./fixtures.mjs";
const model = "synthetic-provider";
const assess = (value = input, requirements = [row()]) =>
  assessEvidence(value, { requirements }, model);
test("coverage is derived from grounded required evidence, not provider numbers", () => {
  const result = assess();
  assert.equal(result.rubricVersion, ATS_RUBRIC);
  assert.equal(result.score, 100);
  assert.deepEqual(result.coverage, {
    required: { supported: 1, total: 1 },
    preferred: { supported: 0, total: 0 },
  });
  assert.throws(
    () => assessEvidence(input, { requirements: [row()], score: 100 }, model),
    AtsUnavailable,
  );
});
test("missing requirements lower required coverage without preferred-score padding", () => {
  const requirements = [
    row(),
    row({
      id: "sql",
      requirement: "PostgreSQL experience",
      jdQuote: "Preferred: experience with PostgreSQL databases.",
      importance: "required",
      status: "missing",
      evidence: [],
    }),
  ];
  const result = assess(input, requirements);
  assert.equal(result.score, 50);
  assert.equal(result.coverage.required.supported, 1);
});
test("preferred requirements stay separate and apply only without required criteria", () => {
  const preferred = row({
    id: "sql",
    requirement: "PostgreSQL experience",
    jdQuote: "Preferred: experience with PostgreSQL databases.",
    importance: "preferred",
    status: "missing",
    evidence: [],
  });
  assert.equal(assess(input, [row(), preferred]).score, 100);
  assert.equal(assess(input, [preferred]).score, 0);
  assert.equal(assess(input, [preferred]).coverage.preferred.total, 1);
});
test("uncertain evidence receives no supported credit", () => {
  const result = assess(input, [row({ status: "uncertain" })]);
  assert.equal(result.score, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("Uncertain")));
});
test("synonyms may be supported with exact original evidence", () => {
  const value = {
    jdText:
      "Requirements\nPostgreSQL database development and maintenance experience is required.",
    sources: [
      {
        id: "experience:one",
        kind: "experience",
        text: "Developed and maintained production Postgres databases.",
      },
    ],
  };
  const result = assess(value, [
    row({
      requirement: "PostgreSQL database development",
      jdQuote:
        "PostgreSQL database development and maintenance experience is required.",
      evidence: [
        {
          sourceId: "experience:one",
          quote: "Developed and maintained production Postgres databases.",
        },
      ],
    }),
  ]);
  assert.equal(result.score, 100);
  assert.equal(result.requirements[0].evidence[0].quote, value.sources[0].text);
});
test("nontechnical license and certification criteria need no catalog", () => {
  const value = {
    jdText:
      "Registered Nurse\nRequirements\nCurrent RN license is required. BLS certification is required.",
    sources: [
      {
        id: "certification:rn",
        kind: "certifications",
        text: "Current registered nurse (RN) license.",
      },
    ],
  };
  const result = assess(value, [
    row({
      id: "rn",
      requirement: "Current RN license",
      jdQuote: "Current RN license is required.",
      evidence: [
        {
          sourceId: "certification:rn",
          quote: "Current registered nurse (RN) license.",
        },
      ],
    }),
    row({
      id: "bls",
      requirement: "BLS certification",
      jdQuote: "BLS certification is required.",
      status: "missing",
      evidence: [],
    }),
  ]);
  assert.equal(result.score, 50);
  assert.equal(result.coverage.required.total, 2);
});
test("valid alternatives remain one criterion", () => {
  const value = {
    jdText:
      "Requirements\nExperience with either Python or R is required for this analyst position.",
    sources: [
      {
        id: "experience:one",
        kind: "experience",
        text: "Analyzed survey data using R.",
      },
    ],
  };
  const result = assess(value, [
    row({
      requirement: "Python or R experience",
      jdQuote: "Experience with either Python or R is required",
      evidence: [
        { sourceId: "experience:one", quote: "Analyzed survey data using R." },
      ],
    }),
  ]);
  assert.equal(result.score, 100);
  assert.equal(result.coverage.required.total, 1);
});
for (const source of [
  "I have never used Python for any professional software project.",
  "I do not have experience using Python.",
  "No experience with Python.",
  "I am not proficient in Python.",
  "Not Python",
])
  test(`clearly negated supporting context is rejected: ${source}`, () => {
    const value = {
      ...input,
      sources: [{ id: "experience:one", kind: "experience", text: source }],
    };
    assert.throws(
      () =>
        assess(value, [
          row({ evidence: [{ sourceId: "experience:one", quote: "Python" }] }),
        ]),
      AtsUnavailable,
    );
    assert.equal(
      assess(value, [row({ status: "missing", evidence: [] })]).score,
      0,
    );
  });
test("negative context elsewhere does not erase independently quoted support", () => {
  const text =
    "I have never used R. Built Python services to process inventory.";
  const result = assess(
    { ...input, sources: [{ id: "experience:one", kind: "experience", text }] },
    [
      row({
        evidence: [
          {
            sourceId: "experience:one",
            quote: "Built Python services to process inventory.",
          },
        ],
      }),
    ],
  );
  assert.equal(result.score, 100);
});
test("duplicate IDs and repeated requirement text cannot inflate score", () => {
  assert.throws(() => assess(input, [row(), row()]), AtsUnavailable);
  assert.throws(
    () =>
      assess(input, [
        row(),
        row({ id: "again", requirement: "  PYTHON   experience " }),
      ]),
    AtsUnavailable,
  );
});
test("keyword repetition creates no additional score credit", () => {
  const value = {
    ...input,
    sources: [
      {
        id: "experience:one",
        kind: "skills",
        text: "Python Python Python Python",
      },
    ],
  };
  const result = assess(value, [
    row({ evidence: [{ sourceId: "experience:one", quote: "Python" }] }),
  ]);
  assert.equal(result.coverage.required.total, 1);
  assert.equal(result.coverage.required.supported, 1);
});
test("unknown source, forged quote, and forged JD quote fail closed", () => {
  for (const requirements of [
    [
      row({
        evidence: [{ sourceId: "other-owner", quote: input.sources[0].text }],
      }),
    ],
    [
      row({
        evidence: [
          {
            sourceId: "experience:one",
            quote: "Invented Python qualification",
          },
        ],
      }),
    ],
    [row({ jdQuote: "Invented job requirement" })],
  ])
    assert.throws(() => assess(input, requirements), AtsUnavailable);
});
test("empty criteria, missing supporting evidence, and duplicated evidence fail closed", () => {
  assert.throws(() => assess(input, []), AtsUnavailable);
  assert.throws(() => assess(input, [row({ evidence: [] })]), AtsUnavailable);
  assert.throws(
    () =>
      assess(input, [
        row({ evidence: [...row().evidence, ...row().evidence] }),
      ]),
    AtsUnavailable,
  );
});
test("empty resume can receive only missing or uncertain evidence, never ungrounded support", () => {
  const value = { ...input, sources: [] };
  assert.equal(
    assess(value, [row({ status: "missing", evidence: [] })]).score,
    0,
  );
  assert.throws(() => assess(value), AtsUnavailable);
});
test("contract requires a JD, unique sources, and bounded professional text", () => {
  for (const value of [
    { ...input, jdText: "" },
    { ...input, jdText: "a".repeat(12001) },
    { ...input, sources: [...input.sources, ...input.sources] },
    {
      ...input,
      sources: [{ id: "a", kind: "skills", text: "x".repeat(6001) }],
    },
    {
      ...input,
      sources: Array.from({ length: 11 }, (_, i) => ({
        id: String(i),
        kind: "skills",
        text: "x".repeat(6000),
      })),
    },
  ])
    assert.equal(atsAssessmentInputSchema.safeParse(value).success, false);
});
test("output contract independently rejects tampered score and coverage", () => {
  const result = assess();
  assert.equal(
    atsAssessmentSchema.safeParse({ ...result, score: 99 }).success,
    false,
  );
  assert.equal(
    atsAssessmentSchema.safeParse({
      ...result,
      coverage: { ...result.coverage, required: { supported: 0, total: 1 } },
    }).success,
    false,
  );
});
