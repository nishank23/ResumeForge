import test from "node:test";
import assert from "node:assert/strict";
import { createGatewayApp } from "../dist/app.js";
test("job fit forwards through owner service; internal ATS routes remain unavailable", async () => {
  const calls = [];
  const app = createGatewayApp(async (url, options) => {
    calls.push({ url, options });
    return new Response('{"data":{"currentVersion":1,"evaluation":null}}');
  });
  const path =
    "/api/v1/resume/12345678-1234-4123-8123-123456789012/ats-assessment";
  const response = await app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer synthetic-user-session",
      "X-Workspace-Id": "synthetic-workspace",
      Cookie: "private=x",
    },
    body: JSON.stringify({
      expectedVersion: 1,
      jdText: "Synthetic job description with required Python experience.",
      consent: true,
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(calls[0].url, `http://127.0.0.1:4003${path}`);
  assert.equal(
    calls[0].options.headers.get("Authorization"),
    "Bearer synthetic-user-session",
  );
  assert.equal(calls[0].options.headers.get("Cookie"), null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  for (const internal of ["/internal/ats/assess", "/internal/ats/health"])
    assert.equal((await app.request(internal)).status, 404);
  assert.equal(calls.length, 1);
});
