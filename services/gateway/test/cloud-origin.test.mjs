import test from "node:test";
import assert from "node:assert/strict";
import { createGatewayApp } from "../dist/app.js";

test("cloud gateway accepts only its configured origin and keeps private routes closed", async () => {
  let calls = 0;
  const app = createGatewayApp(async () => {
    calls++;
    return new Response("{}");
  }, "https://demo.example.com");
  for (const origin of ["http://localhost:3000", "https://foreign.example.com"])
    assert.equal(
      (await app.request("/api/v1/resume", { headers: { Origin: origin } }))
        .status,
      403,
    );
  assert.equal(calls, 0);
  assert.equal((await app.request("/internal/auth/resolve")).status, 404);
  assert.equal((await app.request("/api/v1/workspaces")).status, 404);
  const response = await app.request("/api/v1/resume", {
    headers: { Origin: "https://demo.example.com" },
  });
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://demo.example.com",
  );
  assert.equal(calls, 1);
});
