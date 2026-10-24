import assert from "node:assert/strict";
import test from "node:test";
import { createAtsApp, ATS_MAX_BODY_BYTES } from "../dist/app.js";
import { assessEvidence } from "../dist/assessment.js";
import { input, row, key } from "./fixtures.mjs";
const result = assessEvidence(
  input,
  { requirements: [row()] },
  "synthetic-provider",
);
const options = (value = input) => ({
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(value),
});
test("internal routes require bearer auth including health", async () => {
  let calls = 0;
  const app = createAtsApp({
    key,
    assess: async () => {
      calls++;
      return result;
    },
  });
  for (const authorization of [
    undefined,
    "",
    "Basic fake",
    "Bearer wrong",
    `Bearer ${key}wrong`,
  ]) {
    const headers =
      authorization === undefined ? {} : { Authorization: authorization };
    assert.equal(
      (await app.request("/internal/ats/health", { headers })).status,
      401,
    );
    assert.equal(
      (
        await app.request("/internal/ats/assess", {
          ...options(),
          headers: {
            ...options().headers,
            ...headers,
            Authorization: authorization ?? "",
          },
        })
      ).status,
      401,
    );
  }
  const health = await app.request("/internal/ats/health", {
    headers: { Authorization: `Bearer ${key}` },
  });
  assert.equal(health.status, 200);
  assert.equal((await health.json()).available, true);
  assert.equal(calls, 0);
});
test("valid request returns checked evidence and private response headers", async () => {
  const app = createAtsApp({
    key,
    assess: async (value) => {
      assert.deepEqual(value, input);
      return result;
    },
  });
  const response = await app.request("/internal/ats/assess", options());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), result);
});
test("bad content, empty JD, duplicate source IDs, and malformed JSON never call provider", async () => {
  let calls = 0;
  const app = createAtsApp({
    key,
    assess: async () => {
      calls++;
      return result;
    },
  });
  for (const request of [
    options({ ...input, jdText: "" }),
    options({ ...input, sources: [...input.sources, ...input.sources] }),
    { ...options(), body: "{broken" },
    {
      ...options(),
      headers: { ...options().headers, "Content-Type": "text/plain" },
    },
  ])
    assert.equal(
      (await app.request("/internal/ats/assess", request)).status,
      400,
    );
  assert.equal(calls, 0);
});
test("declared and streamed body caps reject before provider", async () => {
  let calls = 0;
  const app = createAtsApp({
    key,
    assess: async () => {
      calls++;
      return result;
    },
  });
  const declared = await app.request("/internal/ats/assess", {
    ...options(),
    headers: {
      ...options().headers,
      "Content-Length": String(ATS_MAX_BODY_BYTES + 1),
    },
  });
  assert.equal(declared.status, 413);
  const streamed = await app.request("/internal/ats/assess", {
    ...options(),
    body: "x".repeat(ATS_MAX_BODY_BYTES + 1),
  });
  assert.equal(streamed.status, 413);
  assert.equal(calls, 0);
});
test("at most two analyses active, third fails promptly with503", async () => {
  const finish = [];
  const app = createAtsApp({
    key,
    assess: async () => await new Promise((resolve) => finish.push(resolve)),
  });
  const first = app.request("/internal/ats/assess", options());
  const second = app.request("/internal/ats/assess", options());
  while (finish.length < 2)
    await new Promise((resolve) => setTimeout(resolve, 1));
  const third = await app.request("/internal/ats/assess", options());
  assert.equal(third.status, 503);
  assert.equal((await third.json()).error.code, "ats_busy");
  finish.forEach((resolve) => resolve(result));
  assert.equal((await first).status, 200);
  assert.equal((await second).status, 200);
  assert.equal(
    (
      await app.request("/internal/ats/health", {
        headers: { Authorization: `Bearer ${key}` },
      })
    ).status,
    200,
  );
});
test("timeout returns503 and retains slot until provider work settles", async () => {
  const finish = [];
  const app = createAtsApp({
    key,
    timeoutMs: 10,
    assess: async () => await new Promise((resolve) => finish.push(resolve)),
  });
  assert.equal(
    (await app.request("/internal/ats/assess", options())).status,
    503,
  );
  assert.equal(
    (await app.request("/internal/ats/assess", options())).status,
    503,
  );
  const busy = await app.request("/internal/ats/assess", options());
  assert.equal((await busy.json()).error.code, "ats_busy");
  finish.forEach((resolve) => resolve(result));
});
test("unexpected provider errors and tampered output are sanitized", async () => {
  for (const assess of [
    async () => {
      throw new Error("PRIVATE resume or key");
    },
    async () => ({ ...result, score: 42 }),
  ]) {
    const app = createAtsApp({ key, assess });
    const response = await app.request("/internal/ats/assess", options());
    assert.equal(response.status, 503);
    assert.equal((await response.text()).includes("PRIVATE"), false);
  }
});
test("weak credentials and unbounded timeouts fail startup", () => {
  assert.throws(() =>
    createAtsApp({ key: "weak", assess: async () => result }),
  );
  assert.throws(() =>
    createAtsApp({ key, timeoutMs: 60001, assess: async () => result }),
  );
});
