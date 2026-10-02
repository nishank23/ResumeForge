import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { createSessionController } from "../../../packages/shared/src/auth/session.ts";
import {
  resolveProtectedRoute,
  sessionHome,
  sessionRouteKey,
} from "../src/routing.ts";

const identity = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  name: "Synthetic",
  isOnboarded: false,
};
const authenticated = { status: "authenticated", identity };

// Compile the actual JSX boundary in memory using the pinned compiler; no mocks
// for router/components and no generated files left in the checkout.
const compiled = ts
  .transpileModule(
    readFileSync(new URL("../src/SessionRoutes.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  )
  .outputText.replace(
    /from "([^"]+)"/g,
    (_match, specifier) =>
      `from "${
        specifier === "./routing"
          ? new URL("../src/routing.ts", import.meta.url).href
          : import.meta.resolve(specifier)
      }"`,
  );
const { ProtectedRoute, SignInRoute, OnboardingEntry } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const retry = () => Promise.resolve();

test("unverified, anonymous and unavailable sessions never open protected content", () => {
  for (const selected of [undefined, identity.workspaceId]) {
    assert.deepEqual(resolveProtectedRoute({ status: "loading" }, selected), {
      kind: "loading",
    });
    assert.deepEqual(resolveProtectedRoute({ status: "anonymous" }, selected), {
      kind: "redirect",
      to: "/sign-in",
    });
    assert.deepEqual(resolveProtectedRoute({ status: "error" }, selected), {
      kind: "recover",
    });
    assert.deepEqual(
      resolveProtectedRoute({ status: "error", operation: "logout" }, selected),
      { kind: "recover" },
    );
  }
});
test("only the verified personal workspace selector is allowed", () => {
  assert.deepEqual(resolveProtectedRoute(authenticated, identity.workspaceId), {
    kind: "allow",
  });
  assert.deepEqual(resolveProtectedRoute(authenticated), { kind: "allow" });
  for (const selector of [
    "",
    "ws-personal-01",
    "33333333-3333-4333-8333-333333333333",
    "https://evil.invalid",
    "../resumes",
  ])
    assert.deepEqual(resolveProtectedRoute(authenticated, selector), {
      kind: "deny",
    });
});
test("entry destination follows server onboarding state and authoritative workspace", () => {
  assert.equal(sessionHome(identity), "/onboarding");
  assert.equal(
    sessionHome({ ...identity, isOnboarded: true }),
    `/w/${identity.workspaceId}/resumes`,
  );
});
test("route boundary resets when identity, workspace or access status changes", () => {
  const key = sessionRouteKey(authenticated);
  assert.equal(
    sessionRouteKey({
      ...authenticated,
      identity: { ...identity, name: "Updated" },
    }),
    key,
  );
  assert.notEqual(
    sessionRouteKey({
      ...authenticated,
      identity: { ...identity, id: "different-user" },
    }),
    key,
  );
  assert.notEqual(
    sessionRouteKey({
      ...authenticated,
      identity: { ...identity, workspaceId: "different-workspace" },
    }),
    key,
  );
  for (const status of ["loading", "anonymous", "error"])
    assert.notEqual(sessionRouteKey({ status }), key);
});
test("session bootstrap, outage, recovery and logout drive the routing boundary", async () => {
  let mode = "ok";
  const controller = createSessionController({
    exclusive: (operation) => operation(),
    notifyLogout() {},
    request: async (url) => {
      if (mode === "outage") throw new Error("Synthetic outage");
      if (url.endsWith("/logout")) return new Response(null, { status: 204 });
      return new Response(
        JSON.stringify({
          data: url.endsWith("/refresh")
            ? { accessToken: "a".repeat(64), expiresIn: 300 }
            : identity,
        }),
      );
    },
  });
  assert.equal(
    resolveProtectedRoute(controller.getSnapshot(), identity.workspaceId).kind,
    "loading",
  );
  await controller.restore();
  const mountedKey = sessionRouteKey(controller.getSnapshot());
  assert.equal(
    resolveProtectedRoute(controller.getSnapshot(), identity.workspaceId).kind,
    "allow",
  );
  mode = "outage";
  await controller.restore();
  assert.equal(
    resolveProtectedRoute(controller.getSnapshot(), identity.workspaceId).kind,
    "recover",
  );
  assert.notEqual(sessionRouteKey(controller.getSnapshot()), mountedKey);
  mode = "ok";
  await controller.restore();
  assert.equal(
    resolveProtectedRoute(controller.getSnapshot(), identity.workspaceId).kind,
    "allow",
  );
  await controller.logout();
  assert.deepEqual(
    resolveProtectedRoute(controller.getSnapshot(), identity.workspaceId),
    { kind: "redirect", to: "/sign-in" },
  );
});

test("actual nested route never mounts children before verification or on scope denial", () => {
  let mounts = 0;
  function Child() {
    mounts++;
    return h("p", null, "Private child sentinel");
  }
  const render = (session, selected) =>
    renderToStaticMarkup(
      h(
        MemoryRouter,
        { initialEntries: [`/w/${selected}/profile`] },
        h(
          Routes,
          null,
          h(
            Route,
            {
              path: "/w/:workspaceId",
              element: h(ProtectedRoute, { session, retry, workspace: true }),
            },
            h(Route, { path: "profile", element: h(Child) }),
          ),
        ),
      ),
    );
  for (const session of [
    { status: "loading" },
    { status: "anonymous" },
    { status: "error" },
  ]) {
    assert.equal(
      render(session, identity.workspaceId).includes("Private child sentinel"),
      false,
    );
    assert.equal(mounts, 0);
  }
  const denied = render(authenticated, "other-workspace");
  assert.match(denied, /This workspace isn’t available/);
  assert.equal(mounts, 0);
  assert.match(
    render(authenticated, identity.workspaceId),
    /Private child sentinel/,
  );
  assert.equal(mounts, 1);
});

test("OAuth handoff cannot follow injected return URLs or hide callback errors", () => {
  const render = (session, search) =>
    renderToStaticMarkup(
      h(
        MemoryRouter,
        { initialEntries: [`/sign-in${search}`] },
        h(SignInRoute, { session }, h("p", null, "Sign-in recovery sentinel")),
      ),
    );
  assert.equal(
    render(authenticated, "?auth=success&returnTo=https://evil.invalid"),
    "",
  );
  assert.match(
    render(
      authenticated,
      "?auth_error=cancelled&returnTo=https://evil.invalid",
    ),
    /Sign-in recovery sentinel/,
  );
  assert.match(
    render(authenticated, "?auth=success&auth_error=cancelled"),
    /Sign-in recovery sentinel/,
  );
  assert.match(
    render({ status: "anonymous" }, "?auth=success"),
    /Sign-in recovery sentinel/,
  );
});

test("onboarding entry does not fabricate a completed wizard or profile fields", () => {
  const html = renderToStaticMarkup(
    h(MemoryRouter, null, h(OnboardingEntry, { session: authenticated })),
  );
  assert.match(html, /Set up your profile/);
  assert.match(html, /Profile setup is being connected/);
  assert.match(html, new RegExp(`/w/${identity.workspaceId}/resumes`));
  assert.equal(html.includes("<input"), false);
  assert.equal(
    renderToStaticMarkup(
      h(
        MemoryRouter,
        null,
        h(OnboardingEntry, {
          session: {
            status: "authenticated",
            identity: { ...identity, isOnboarded: true },
          },
        }),
      ),
    ),
    "",
  );
});
