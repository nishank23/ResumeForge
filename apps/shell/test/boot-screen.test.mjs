import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(
  script,
  "The pre-React handoff must be available without the app bundle",
);

function bootEnvironment() {
  const attributes = new Set(["inert", "aria-hidden"]);
  const listeners = new Map();
  let main;
  let changed;
  let retry;
  let timeout;
  let cleared = false;
  let disconnected = false;
  let removed = false;
  const boot = {
    dataset: {},
    remove() {
      removed = true;
    },
  };
  const root = {
    querySelector() {
      return main;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
  };
  const document = {
    hidden: false,
    getElementById: (id) => (id === "root" ? root : boot),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
  };
  runInNewContext(script, {
    document,
    window: {
      setTimeout(callback, delay) {
        retry = callback;
        timeout = delay;
        return 1;
      },
      clearTimeout(id) {
        assert.equal(id, 1);
        cleared = true;
      },
    },
    MutationObserver: class {
      constructor(callback) {
        changed = callback;
      }
      observe(target) {
        assert.equal(target, root);
      }
      disconnect() {
        disconnected = true;
      }
    },
  });
  return {
    boot,
    document,
    listeners,
    attributes,
    render(text, loading = false) {
      main =
        text === undefined
          ? undefined
          : {
              textContent: text,
              querySelector: () => (loading ? {} : null),
            };
      if (!disconnected) changed();
    },
    expire() {
      retry();
    },
    state: () => ({ removed, disconnected, cleared, timeout }),
  };
}

test("first-load screen spans bootstrap, session loading and empty route redirects", () => {
  const env = bootEnvironment();
  for (const [text, loading] of [
    [undefined, false],
    ["Loading your workspace", true],
    ["", false],
    ["  ", false],
  ]) {
    env.render(text, loading);
    assert.equal(env.state().removed, false);
    assert.ok(env.attributes.has("inert"));
  }
  env.render("Make your next move. Continue with Google");
  assert.deepEqual(env.state(), {
    removed: true,
    disconnected: true,
    cleared: true,
    timeout: 15000,
  });
  assert.equal(env.attributes.size, 0);
  assert.equal(env.listeners.size, 0);
});

test("real session or remote errors are revealed without an animation delay", () => {
  for (const text of [
    "We couldn’t verify your session. Retry session check",
    "Sign-in couldn't load. Try again",
    "My resumes",
  ]) {
    const env = bootEnvironment();
    env.render(text);
    assert.equal(env.state().removed, true);
    assert.equal(env.attributes.size, 0);
  }
});

test("a stalled app exposes reload without pretending to finish loading", () => {
  const env = bootEnvironment();
  assert.equal(env.state().timeout, 15000);
  assert.equal(env.boot.dataset.waiting, undefined);
  env.expire();
  assert.equal(env.boot.dataset.waiting, "true");
  assert.equal(env.state().removed, false);
  env.render("Continue with Google");
  assert.equal(env.state().removed, true);
});

test("hidden tabs pause decoration and later navigations cannot restore the first-load screen", () => {
  const env = bootEnvironment();
  assert.equal(env.boot.dataset.paused, "false");
  env.document.hidden = true;
  env.listeners.get("visibilitychange")();
  assert.equal(env.boot.dataset.paused, "true");
  env.document.hidden = false;
  env.listeners.get("visibilitychange")();
  assert.equal(env.boot.dataset.paused, "false");
  env.render("Continue with Google");
  env.render("Loading your workspace", true);
  assert.equal(env.state().removed, true);
  assert.equal(env.listeners.size, 0);
});
