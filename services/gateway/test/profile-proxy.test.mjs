import test from "node:test";
import assert from "node:assert/strict";
import { createGatewayApp } from "../dist/app.js";
test("forwards only profile routes, credentials and scoped headers without cookies", async () => {
  const calls = [];
  const app = createGatewayApp(async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ data: { revision: 2 } }), {
      status: 201,
      headers: {
        "X-Request-Id": "synthetic-request",
        "Set-Cookie": "must-not-forward=x",
        "Cache-Control": "public",
      },
    });
  });
  const response = await app.request("/api/v1/profile", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      Authorization: "Bearer synthetic",
      Cookie: "private=x",
      "Content-Type": "application/json",
      "X-Workspace-Id": "synthetic-workspace",
      "X-User-Id": "forged",
    },
    body: '{"fullName":"Synthetic"}',
  });
  assert.equal(response.status, 201);
  assert.equal(calls[0].url, "http://127.0.0.1:4002/api/v1/profile");
  assert.equal(
    calls[0].options.headers.get("Authorization"),
    "Bearer synthetic",
  );
  assert.equal(
    calls[0].options.headers.get("X-Workspace-Id"),
    "synthetic-workspace",
  );
  assert.equal(calls[0].options.headers.get("Cookie"), null);
  assert.equal(calls[0].options.headers.get("X-User-Id"), null);
  assert.equal(
    await new Response(calls[0].options.body).text(),
    '{"fullName":"Synthetic"}',
  );
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000",
  );
  assert.equal(response.headers.get("X-Request-Id"), "synthetic-request");
});
test("denies foreign origins, unconnected routes and unsupported methods", async () => {
  let calls = 0;
  const app = createGatewayApp(async () => {
    calls++;
    return new Response("{}");
  });
  assert.equal(
    (
      await app.request("/api/v1/profile", {
        headers: { Origin: "http://evil.invalid" },
      })
    ).status,
    403,
  );
  for (const path of [
    "/api/v1/profile/contact",
    "/api/v1/profile/complete",
    "/internal/auth/resolve",
    "/api/v1/resumes",
  ])
    assert.equal((await app.request(path)).status, 404);
  assert.equal(
    (await app.request("/api/v1/profile", { method: "DELETE" })).status,
    404,
  );
  assert.equal(
    (await app.request("/api/v1/profile/draft", { method: "GET" })).status,
    404,
  );
  assert.equal(calls, 0);
});
test("preserves conflicts and query rejection; sanitizes transport failure", async () => {
  const app = createGatewayApp(async (url) => {
    assert.ok(url.endsWith("?profileId=foreign"));
    return new Response('{"error":{"code":"invalid_input"}}', { status: 422 });
  });
  assert.equal(
    (await app.request("/api/v1/profile?profileId=foreign")).status,
    422,
  );
  const conflict = createGatewayApp(
    async () =>
      new Response('{"error":{"code":"revision_conflict"}}', { status: 409 }),
  );
  assert.equal((await conflict.request("/api/v1/profile")).status, 409);
  const outage = createGatewayApp(async () => {
    throw Error("private connection details");
  });
  const response = await outage.request("/api/v1/profile");
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("private"), false);
});
test("shell preflight accepts profile write headers; unrelated origins receive no access", async () => {
  const app = createGatewayApp();
  const response = await app.request("/api/v1/profile/draft", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers":
        "authorization,content-type,x-workspace-id",
    },
  });
  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000",
  );
  assert.ok(
    response.headers
      .get("Access-Control-Allow-Headers")
      .includes("Authorization"),
  );
  const denied = await app.request("/api/v1/profile", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3002" },
  });
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
});

test("private PDF bytes, version and attachment headers survive proxy; no upstream cookies or cache leak", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const app = createGatewayApp(async (url, options) => {
    assert.equal(
      url,
      `http://127.0.0.1:4003/api/v1/resume/${id}/pdf?version=2`,
    );
    assert.equal(options.headers.get("Cookie"), null);
    return new Response("%PDF-valid", {
      headers: {
        "Content-Type": "application/pdf",
        "X-Resume-Version": "2",
        "Content-Disposition": "attachment; filename=resume-v2.pdf",
        "Set-Cookie": "forbidden=x",
        "Cache-Control": "public",
      },
    });
  });
  const r = await app.request(`/api/v1/resume/${id}/pdf?version=2`, {
    headers: {
      Origin: "http://localhost:3000",
      Authorization: "Bearer synthetic",
      Cookie: "private=x",
    },
  });
  assert.equal(await r.text(), "%PDF-valid");
  assert.equal(r.headers.get("Content-Type"), "application/pdf");
  assert.equal(r.headers.get("X-Resume-Version"), "2");
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  assert.equal(r.headers.get("Set-Cookie"), null);
  assert.ok(
    r.headers.get("Access-Control-Expose-Headers").includes("X-Resume-Version"),
  );
  const failing = createGatewayApp(
    async () =>
      new Response('{"error":{"code":"revision_conflict"}}', { status: 409 }),
  );
  const failed = await failing.request(`/api/v1/resume/${id}/pdf?version=2`);
  assert.equal(failed.headers.get("Content-Type"), "application/json");
  assert.equal(failed.status, 409);
});
test("DELETE/restore proxy keeps scoped body and approved preflight", async () => {
  const calls = [];
  const app = createGatewayApp(async (url, options) => {
    calls.push({ url, options });
    return new Response("{}");
  });
  const path = "/api/v1/resume/11111111-1111-4111-8111-111111111111";
  for (const [route, method] of [
    [path, "DELETE"],
    [`${path}/restore`, "POST"],
  ]) {
    await app.request(route, {
      method,
      headers: { "Content-Type": "application/json" },
      body: '{"expectedVersion":2}',
    });
    assert.equal(calls.at(-1).options.method, method);
    assert.equal(
      await new Response(calls.at(-1).options.body).text(),
      '{"expectedVersion":2}',
    );
  }
  const preflight = await app.request(path, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "DELETE",
    },
  });
  assert.ok(
    preflight.headers.get("Access-Control-Allow-Methods").includes("DELETE"),
  );
});
