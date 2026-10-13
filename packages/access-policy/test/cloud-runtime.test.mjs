import test from "node:test";
import assert from "node:assert/strict";
import { runtimeAppOrigin } from "../dist/server.js";

const cloud = {
  NODE_ENV: "production",
  RESUME_FORGE_RUNTIME: "cloud",
  FORGE_PUBLIC_ORIGIN: "https://demo.example.com",
};
test("production requires explicit cloud mode and a canonical HTTPS domain", () => {
  assert.equal(runtimeAppOrigin({}), "http://localhost:3000");
  assert.equal(runtimeAppOrigin(cloud), cloud.FORGE_PUBLIC_ORIGIN);
  assert.throws(() => runtimeAppOrigin({ NODE_ENV: "production" }));
  assert.throws(() => runtimeAppOrigin({ ...cloud, NODE_ENV: "development" }));
  for (const origin of [
    undefined,
    "http://demo.example.com",
    "https://localhost",
    "https://app.localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://demo.example.com:8443",
    "https://demo.example.com/",
    "https://demo.example.com/path",
    "https://demo.example.com?override=1",
    "https://user:password@demo.example.com",
  ])
    assert.throws(() =>
      runtimeAppOrigin({ ...cloud, FORGE_PUBLIC_ORIGIN: origin }),
    );
});
