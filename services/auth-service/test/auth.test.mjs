import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createDatabaseClient,
  runtimeRoleNames,
  assertRuntimeDatabaseRole,
} from "@resume-forge/prisma-client";
import {
  Client,
  provisionRuntimeRoles,
} from "../../../scripts/runtime-roles.mjs";
import { createAuthApp } from "../dist/app.js";
import { createGoogleProvider } from "../dist/google.js";

const root = new URL("../../../", import.meta.url);
const local = parseEnv(
  readFileSync(new URL(".local/database.env", root), "utf8"),
);
const url = new URL(local.DATABASE_URL);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "55432");
const name = `rf_auth_test_${randomUUID().replaceAll("-", "")}`;
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port,
  PGUSER: url.username,
  PGPASSWORD: decodeURIComponent(url.password),
};
const sql = (query) => {
  const result = spawnSync(
    "psql",
    ["-X", "-v", "ON_ERROR_STOP=1", "-d", "postgres", "-c", query],
    { env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, "Test database lifecycle failed");
};
const cookie = (response, key) =>
  response.headers
    .getSetCookie()
    .find((item) => item.startsWith(`${key}=`))
    ?.split(";")[0];

test("Google local auth with synthetic provider and real PostgreSQL", async (t) => {
  sql(`CREATE DATABASE "${name}"`);
  url.pathname = `/${name}`;
  const db = createDatabaseClient(url.href);
  const prefix = `rf_auth_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const names = runtimeRoleNames(prefix);
  const passwords = Object.fromEntries(
    Object.keys(names).map((service) => [
      service,
      randomBytes(32).toString("hex"),
    ]),
  );
  const runtimeUrl = new URL(url);
  runtimeUrl.username = names.auth;
  runtimeUrl.password = passwords.auth;
  const runtimeDb = createDatabaseClient(runtimeUrl.href);
  const admin = new Client({ connectionString: url.href });
  let time = Date.now();
  let exchangeCalls = 0;
  let identity = {
    sub: "synthetic-google",
    email: "google@example.invalid",
    email_verified: true,
    name: "Synthetic User",
  };
  const provider = {
    authorizationURL(state, verifier) {
      assert.ok(verifier.length > 20);
      return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`;
    },
    async identity(code) {
      exchangeCalls++;
      if (code === "failure") throw new Error("private provider response");
      return identity;
    },
  };
  const app = createAuthApp({
    db: runtimeDb,
    provider,
    appOrigin: "http://localhost:3000",
    now: () => time,
  });
  const request = (route, options) =>
    app.request(`http://localhost:4001/api/v1/auth/${route}`, options);
  const begin = async () => {
    const response = await request("google/url");
    const body = await response.json();
    return {
      state: new URL(body.url).searchParams.get("state"),
      cookie: cookie(response, "oauth_binding"),
    };
  };
  const finish = async (attempt, code = "synthetic-code") =>
    request(`google/callback?state=${attempt.state}&code=${code}`, {
      headers: { Cookie: attempt.cookie },
    });
  const refresh = (credential, origin = "http://localhost:3000") =>
    request("refresh", {
      method: "POST",
      headers: { Cookie: credential, Origin: origin },
    });
  try {
    const migration = spawnSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      {
        cwd: fileURLToPath(new URL("packages/prisma-client/", root)),
        env: { ...process.env, DATABASE_URL: url.href },
        encoding: "utf8",
      },
    );
    assert.equal(migration.status, 0, "Fresh migrations must apply");
    await admin.connect();
    await provisionRuntimeRoles(admin, {
      databaseName: name,
      prefix,
      passwords,
    });
    await assertRuntimeDatabaseRole(runtimeDb, "auth", names.auth);
    await t.test(
      "real authorization URL uses PKCE and the backend callback",
      () => {
        const google = createGoogleProvider(
          "synthetic-client.apps.googleusercontent.com",
          "synthetic-secret",
          "http://localhost:4001/api/v1/auth/google/callback",
        );
        const target = new URL(
          google.authorizationURL("state", "a".repeat(43)),
        );
        assert.equal(
          target.searchParams.get("redirect_uri"),
          "http://localhost:4001/api/v1/auth/google/callback",
        );
        assert.equal(target.searchParams.get("code_challenge_method"), "S256");
        assert.equal(target.href.includes("synthetic-secret"), false);
      },
    );
    await t.test("missing provider fails explicitly", async () => {
      const missing = createAuthApp({ db, appOrigin: "http://localhost:3000" });
      assert.equal(
        (await missing.request("/api/v1/auth/google/url")).status,
        503,
      );
    });
    await t.test(
      "state binding, expiry, denial and provider failures",
      async () => {
        const attempt = await begin();
        const bad = await request(
          `google/callback?state=${attempt.state}&code=anything`,
        );
        assert.match(bad.headers.get("location"), /invalid_callback/);
        assert.equal(exchangeCalls, 0);
        time += 600001;
        assert.match(
          (await finish(attempt)).headers.get("location"),
          /invalid_callback/,
        );
        const denied = await begin();
        const response = await request(
          `google/callback?state=${denied.state}&error=access_denied`,
          { headers: { Cookie: denied.cookie } },
        );
        assert.match(response.headers.get("location"), /cancelled/);
        assert.match(
          (await finish(denied)).headers.get("location"),
          /invalid_callback/,
        );
        assert.match(
          (await finish(await begin(), "failure")).headers.get("location"),
          /provider_failed/,
        );
      },
    );
    let initial;
    await t.test(
      "callback provisions one identity and rejects replay",
      async () => {
        const attempt = await begin();
        const response = await finish(attempt);
        assert.match(response.headers.get("location"), /signed_in=1/);
        initial = cookie(response, "refresh_token");
        assert.ok(initial);
        assert.match(response.headers.getSetCookie().join(";"), /HttpOnly/);
        assert.match(
          (await finish(attempt)).headers.get("location"),
          /invalid_callback/,
        );
        await finish(await begin());
        assert.equal(await db.user.count(), 1);
        assert.equal(await db.workspace.count(), 1);
        assert.equal(await db.userProfile.count(), 0);
        assert.equal(
          (await db.session.findFirst()).refreshHash.includes(
            initial.split("=")[1],
          ),
          false,
        );
      },
    );
    await t.test("matching email never merges provider subjects", async () => {
      identity = { ...identity, sub: "different-subject" };
      assert.match(
        (await finish(await begin())).headers.get("location"),
        /account_link_required/,
      );
      assert.equal(await db.user.count(), 1);
      identity = { ...identity, sub: "synthetic-google" };
    });
    await t.test(
      "refresh rotates, access expires, replay revokes family",
      async () => {
        assert.equal(
          (await refresh(initial, "https://attacker.invalid")).status,
          403,
        );
        const response = await refresh(initial);
        assert.equal(response.status, 200);
        const current = cookie(response, "refresh_token");
        const { data } = await response.json();
        const headers = { Authorization: `Bearer ${data.accessToken}` };
        assert.equal((await request("me", { headers })).status, 200);
        assert.equal(
          (await request("me", { headers: { Cookie: current } })).status,
          401,
        );
        time += 300001;
        assert.equal((await request("me", { headers })).status, 401);
        assert.equal((await refresh(initial)).status, 401);
        assert.equal((await refresh(current)).status, 401);
      },
    );
    await t.test(
      "logout revokes access and expired refresh is rejected",
      async () => {
        const signedIn = await finish(await begin());
        const response = await refresh(cookie(signedIn, "refresh_token"));
        const current = cookie(response, "refresh_token");
        const { data } = await response.json();
        assert.equal(
          (
            await request("logout", {
              method: "POST",
              headers: { Cookie: current, Origin: "http://localhost:3000" },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("me", {
              headers: { Authorization: `Bearer ${data.accessToken}` },
            })
          ).status,
          401,
        );
        assert.equal((await refresh(current)).status, 401);
        const another = await finish(await begin());
        time += 31 * 24 * 60 * 60 * 1000;
        assert.equal(
          (await refresh(cookie(another, "refresh_token"))).status,
          401,
        );
      },
    );
  } finally {
    await Promise.all([db.$disconnect(), runtimeDb.$disconnect()]);
    await admin.end();
    sql(`DROP DATABASE "${name}" WITH (FORCE)`);
    for (const role of Object.values(names))
      sql(`DROP ROLE IF EXISTS "${role}"`);
  }
});
