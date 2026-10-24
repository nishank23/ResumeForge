import assert from "node:assert/strict";
import test from "node:test";
import {
  createGeminiAssessor,
  ATS_GEMINI_MODEL,
  ATS_SYSTEM_PROMPT,
} from "../dist/gemini.js";
import { AtsUnavailable } from "../dist/assessment.js";
import { input, row, response, envelope } from "./fixtures.mjs";
const settings = { geminiKey: "synthetic-key", paidGemini: true };
test("uses existing Gemini with isolated untrusted JSON, no numeric provider score", async () => {
  let calls = 0;
  const assess = createGeminiAssessor(settings, async (url, options) => {
    calls++;
    assert.ok(url.includes(`${ATS_GEMINI_MODEL}:generateContent`));
    assert.equal(options.headers["x-goog-api-key"], settings.geminiKey);
    const sent = JSON.parse(options.body);
    assert.equal(sent.generationConfig.temperature, 0);
    assert.equal(sent.generationConfig.maxOutputTokens, 8192);
    // Nested array limits caused live HTTP 400; local Zod still enforces caps.
    const requirements =
      sent.generationConfig.responseJsonSchema.properties.requirements;
    assert.equal(requirements.maxItems, undefined);
    assert.equal(requirements.items.properties.evidence.maxItems, undefined);
    assert.equal(
      sent.generationConfig.responseJsonSchema.properties.score,
      undefined,
    );
    assert.equal(sent.contents[0].parts[0].text, JSON.stringify(input));
    assert.ok(sent.systemInstruction.parts[0].text.includes("UNTRUSTED DATA"));
    return response();
  });
  assert.equal((await assess(input)).score, 100);
  assert.equal(calls, 1);
  assert.ok(ATS_SYSTEM_PROMPT.includes("Negated claims, repeated keywords"));
  assert.ok(
    ATS_SYSTEM_PROMPT.includes(
      "licenses and certifications, across all professions",
    ),
  );
});
test("disabled paid mode or absent key makes no external request", async () => {
  let calls = 0;
  for (const configured of [
    { paidGemini: false, geminiKey: "fake" },
    { paidGemini: true },
  ]) {
    const assess = createGeminiAssessor(configured, async () => {
      calls++;
      return response();
    });
    await assert.rejects(assess(input), AtsUnavailable);
  }
  assert.equal(calls, 0);
});
test("network and provider failures stay sanitized and never fallback", async () => {
  for (const transport of [
    async () => {
      throw new Error("SECRET https://private.example/raw-resume");
    },
    async () => new Response("SECRET raw provider error", { status: 403 }),
    async () => new Response("SECRET raw provider error", { status: 429 }),
    async () => new Response("{invalid"),
  ]) {
    const assess = createGeminiAssessor(settings, transport);
    await assert.rejects(
      assess(input),
      (error) =>
        error instanceof AtsUnavailable && !error.message.includes("SECRET"),
    );
  }
});
test("truncated, blocked, numeric, and empty model results fail closed", async () => {
  const truncated = envelope();
  truncated.candidates[0].finishReason = "MAX_TOKENS";
  const numeric = envelope();
  numeric.candidates[0].content.parts[0].text = JSON.stringify({
    requirements: [row()],
    score: 100,
  });
  for (const raw of [
    truncated,
    numeric,
    envelope([]),
    { promptFeedback: { blockReason: "SAFETY" } },
  ]) {
    const assess = createGeminiAssessor(
      settings,
      async () => new Response(JSON.stringify(raw)),
    );
    await assert.rejects(assess(input), AtsUnavailable);
  }
});
test("response size cap prevents unbounded provider output", async () => {
  const assess = createGeminiAssessor(
    settings,
    async () => new Response("x".repeat(196609)),
  );
  await assert.rejects(assess(input), AtsUnavailable);
});
test("provider timeout aborts transport, no retry", async () => {
  let calls = 0;
  let aborted = false;
  const assess = createGeminiAssessor(
    { ...settings, timeoutMs: 15 },
    async (_url, options) => {
      calls++;
      return await new Promise((_resolve, reject) =>
        options.signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new Error("aborted"));
          },
          { once: true },
        ),
      );
    },
  );
  await assert.rejects(
    assess(input),
    (error) =>
      error instanceof AtsUnavailable && /timed out/.test(error.message),
  );
  assert.equal(calls, 1);
  assert.equal(aborted, true);
});
test("explicit caller abort propagates to provider transport", async () => {
  let signal;
  const controller = new AbortController();
  const assess = createGeminiAssessor(settings, async (_url, options) => {
    signal = options.signal;
    return await new Promise((_resolve, reject) =>
      options.signal.addEventListener(
        "abort",
        () => reject(new Error("aborted")),
        { once: true },
      ),
    );
  });
  const pending = assess(input, controller.signal);
  controller.abort();
  await assert.rejects(pending, AtsUnavailable);
  assert.equal(signal.aborted, true);
});
