import test from "node:test";
import assert from "node:assert/strict";
import { createAuthApp } from "../dist/app.js";

test("HTTPS OAuth cookies are secure and foreign refresh origins are denied before database access", async () => {
  const app = createAuthApp({
    db: {},
    appOrigin: "https://demo.example.com",
    provider: {
      authorizationURL: () => "https://accounts.google.com/synthetic",
    },
  });
  const response = await app.request("/api/v1/auth/google/url");
  assert.equal(response.status, 200);
  const cookie = response.headers.get("Set-Cookie");
  assert.match(cookie, /; Secure/i);
  assert.match(cookie, /; HttpOnly/i);
  assert.match(cookie, /; SameSite=Lax/i);
  assert.match(cookie, /; Path=\/api\/v1\/auth/i);
  const denied = await app.request("/api/v1/auth/refresh", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      Cookie: "refresh_token=synthetic",
    },
  });
  assert.equal(denied.status, 403);
});
