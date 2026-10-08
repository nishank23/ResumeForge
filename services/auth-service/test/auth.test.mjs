import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { serve } from "@hono/node-server";
import { createLocalActorResolver } from "@resume-forge/access-policy/server";
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
  readFileSync(
    process.env.RESUME_FORGE_LOCAL_ROOT
      ? `${process.env.RESUME_FORGE_LOCAL_ROOT}/.local/database.env`
      : new URL(".local/database.env", root),
    "utf8",
  ),
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
  const profileServiceKey = randomBytes(32).toString("hex");
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
    profileServiceKey,
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
      "restricted real HTTP actor resolution is minimal and derives each user's personal scope",
      async () => {
        const signedIn = await finish(await begin());
        const response = await refresh(cookie(signedIn, "refresh_token"));
        const { data } = await response.json();
        const me = await (
          await request("me", {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          })
        ).json();
        const revision = await db.session.count();
        const server = serve({
          fetch: app.fetch,
          hostname: "127.0.0.1",
          port: 0,
        });
        await once(server, "listening");
        const endpoint = `http://127.0.0.1:${server.address().port}/internal/auth/resolve`;
        try {
          const resolve = createLocalActorResolver({
            endpoint,
            key: profileServiceKey,
            now: () => time,
          });
          const result = await resolve(`Bearer ${data.accessToken}`);
          assert.deepEqual(result, {
            status: "authenticated",
            actor: {
              userId: me.data.id,
              personalWorkspaceId: me.data.workspaceId,
              expiresAt: time + 300000,
            },
          });
          assert.equal(
            await db.session.count(),
            revision,
            "Resolution must not rotate/create sessions",
          );
          const forged = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${profileServiceKey}`,
              "X-Resume-Forge-Service": "local-profile-service",
              "Content-Type": "application/json",
              "X-User-Id": randomUUID(),
              "X-Workspace-Id": randomUUID(),
              "X-Role": "ORG_OWNER",
            },
            body: JSON.stringify({ accessToken: data.accessToken }),
          });
          assert.equal(forged.status, 200);
          assert.deepEqual(await forged.json(), { data: result.actor });
          identity = {
            sub: "synthetic-google-bob",
            email: "bob@example.invalid",
            email_verified: true,
            name: "Synthetic Bob",
          };
          const bobSignedIn = await finish(await begin());
          const bobResponse = await refresh(
            cookie(bobSignedIn, "refresh_token"),
          );
          const bobToken = (await bobResponse.json()).data.accessToken;
          const bob = await resolve(`Bearer ${bobToken}`);
          assert.equal(bob.status, "authenticated");
          assert.notEqual(bob.actor.userId, result.actor.userId);
          assert.notEqual(
            bob.actor.personalWorkspaceId,
            result.actor.personalWorkspaceId,
          );
          assert.deepEqual(await resolve(`Bearer ${data.accessToken}`), result);
          const restarted = createAuthApp({
            db: runtimeDb,
            profileServiceKey,
            appOrigin: "http://localhost:3000",
            now: () => time,
          });
          const afterRestart = await restarted.request(
            "/internal/auth/resolve",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${profileServiceKey}`,
                "X-Resume-Forge-Service": "local-profile-service",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ accessToken: data.accessToken }),
            },
          );
          assert.equal(
            afterRestart.status,
            401,
            "Process-local access tokens are invalidated on auth restart",
          );
        } finally {
          identity = {
            sub: "synthetic-google",
            email: "google@example.invalid",
            email_verified: true,
            name: "Synthetic User",
          };
          await new Promise((resolve) => {
            server.close(resolve);
            server.closeAllConnections();
          });
        }
      },
    );
    await t.test(
      "internal resolution rechecks expiry, refresh rotation, replay and logout",
      async () => {
        const internal = (token) =>
          app.request("/internal/auth/resolve", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${profileServiceKey}`,
              "X-Resume-Forge-Service": "local-profile-service",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ accessToken: token }),
          });
        const signIn = async () => {
          const signedIn = await finish(await begin());
          const response = await refresh(cookie(signedIn, "refresh_token"));
          return {
            credential: cookie(response, "refresh_token"),
            token: (await response.json()).data.accessToken,
          };
        };
        let current = await signIn();
        assert.equal((await internal(current.token)).status, 200);
        const rotated = await refresh(current.credential);
        const next = {
          credential: cookie(rotated, "refresh_token"),
          token: (await rotated.json()).data.accessToken,
        };
        assert.equal((await internal(current.token)).status, 401);
        assert.equal((await internal(next.token)).status, 200);
        assert.equal((await refresh(current.credential)).status, 401);
        assert.equal((await internal(next.token)).status, 401);
        current = await signIn();
        await request("logout", {
          method: "POST",
          headers: {
            Cookie: current.credential,
            Origin: "http://localhost:3000",
          },
        });
        assert.equal((await internal(current.token)).status, 401);
        current = await signIn();
        time += 300001;
        assert.equal((await internal(current.token)).status, 401);
        current = await signIn();
        const user = await db.user.findUniqueOrThrow({
          where: { email: "google@example.invalid" },
        });
        await db.session.updateMany({
          where: { userId: user.id },
          data: { expiresAt: new Date(time - 1) },
        });
        assert.equal((await internal(current.token)).status, 401);
      },
    );
    await t.test(
      "database failure withholds actor identity and recovers on retry",
      async () => {
        const faultDb = createDatabaseClient(runtimeUrl.href);
        const faultApp = createAuthApp({
          db: faultDb,
          provider,
          profileServiceKey,
          appOrigin: "http://localhost:3000",
          now: () => time,
        });
        try {
          const start = await faultApp.request("/api/v1/auth/google/url");
          const state = new URL((await start.json()).url).searchParams.get(
            "state",
          );
          const signedIn = await faultApp.request(
            `/api/v1/auth/google/callback?state=${state}&code=synthetic-code`,
            { headers: { Cookie: cookie(start, "oauth_binding") } },
          );
          const refreshed = await faultApp.request("/api/v1/auth/refresh", {
            method: "POST",
            headers: {
              Cookie: cookie(signedIn, "refresh_token"),
              Origin: "http://localhost:3000",
            },
          });
          const accessToken = (await refreshed.json()).data.accessToken;
          const original = faultDb.session.findUnique;
          faultDb.session.findUnique = async () => {
            throw new Error("private database/connection information");
          };
          const resolve = () =>
            faultApp.request("/internal/auth/resolve", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${profileServiceKey}`,
                "X-Resume-Forge-Service": "local-profile-service",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ accessToken }),
            });
          const failure = await resolve();
          assert.equal(failure.status, 503);
          assert.deepEqual(await failure.json(), {
            error: { code: "auth_unavailable" },
          });
          faultDb.session.findUnique = original;
          assert.equal((await resolve()).status, 200);
          const owner = await db.user.findUniqueOrThrow({
            where: { email: "google@example.invalid" },
            include: { personalWorkspace: true },
          });
          const workspace = owner.personalWorkspace;
          assert.ok(workspace);
          await db.workspace.delete({ where: { id: workspace.id } });
          try {
            assert.equal(
              (await resolve()).status,
              401,
              "Absent authoritative personal scope denies actor resolution",
            );
          } finally {
            await db.workspace.create({
              data: {
                id: workspace.id,
                type: "individual",
                personalOwnerUserId: owner.id,
              },
            });
          }
          assert.equal((await resolve()).status, 200);
          faultDb.session.findUnique = async (...args) => {
            const value = await original(...args);
            time += 300001;
            return value;
          };
          assert.equal(
            (await resolve()).status,
            401,
            "Access grant expiry is rechecked after database I/O",
          );
          faultDb.session.findUnique = original;
        } finally {
          await faultDb.$disconnect();
        }
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
