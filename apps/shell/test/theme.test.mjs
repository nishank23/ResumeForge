import test from "node:test";
import assert from "node:assert/strict";
import {
  createThemePreference,
  THEME_STORAGE_KEY,
} from "../src/theme-preference.ts";

function environment(dark, stored) {
  const values = new Map(stored === undefined ? [] : [[THEME_STORAGE_KEY, stored]]);
  const listeners = new Set();
  const media = {
    matches: dark,
    addEventListener(_event, callback) { listeners.add(callback); },
    removeEventListener(_event, callback) { listeners.delete(callback); },
  };
  return {
    values,
    listeners,
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    },
    media,
    change(dark) {
      media.matches = dark;
      listeners.forEach((listener) => listener());
    },
  };
}

test("a first visit follows dark or light device preference", () => {
  for (const dark of [true, false]) {
    const env = environment(dark);
    assert.deepEqual(createThemePreference(env).getSnapshot(), {
      preference: "system", theme: dark ? "dark" : "light",
    });
    assert.equal(env.values.size, 0);
  }
});

test("device changes update system mode, manual override stays, reset resumes following", () => {
  const env = environment(true);
  const controller = createThemePreference(env);
  let updates = 0;
  const unsubscribe = controller.subscribe(() => { updates++; });
  env.change(false);
  assert.equal(controller.getSnapshot().theme, "light");
  assert.equal(updates, 1);
  controller.setPreference("dark");
  env.change(true);
  env.change(false);
  assert.deepEqual(controller.getSnapshot(), { preference: "dark", theme: "dark" });
  assert.equal(updates, 2);
  controller.setPreference("system");
  assert.equal(env.values.has(THEME_STORAGE_KEY), false);
  assert.deepEqual(controller.getSnapshot(), { preference: "system", theme: "light" });
  env.change(true);
  assert.equal(controller.getSnapshot().theme, "dark");
  unsubscribe();
  assert.equal(env.listeners.size, 0);
});

test("saved manual preferences survive reload independently of the device", () => {
  for (const mode of ["dark", "light"]) {
    const env = environment(mode === "light");
    const firstVisit = createThemePreference(env);
    firstVisit.setPreference(mode);
    assert.equal(env.values.get(THEME_STORAGE_KEY), mode);
    assert.deepEqual(createThemePreference(env).getSnapshot(), {
      preference: mode, theme: mode,
    });
  }
});

test("invalid or blocked storage falls back to device without breaking manual controls", () => {
  for (const stored of ["", "invalid", "null", "{broken}"]) {
    assert.deepEqual(createThemePreference(environment(true, stored)).getSnapshot(), {
      preference: "system", theme: "dark",
    });
  }
  const blocked = {
    getItem() { throw new Error("Storage unavailable"); },
    setItem() { throw new Error("Storage unavailable"); },
    removeItem() { throw new Error("Storage unavailable"); },
  };
  const controller = createThemePreference({ storage: blocked, media: environment(true).media });
  controller.setPreference("light");
  assert.equal(controller.getSnapshot().theme, "light");
  controller.setPreference("system");
  assert.equal(controller.getSnapshot().theme, "dark");
  assert.deepEqual(createThemePreference({}).getSnapshot(), { preference: "system", theme: "light" });
});

test("subscription catches a missed device change and cleans up after remount", () => {
  const env = environment(false);
  const controller = createThemePreference(env);
  env.change(true);
  let updates = 0;
  const first = controller.subscribe(() => { updates++; });
  const second = controller.subscribe(() => { updates++; });
  assert.equal(controller.getSnapshot().theme, "dark");
  assert.equal(updates, 1);
  assert.equal(env.listeners.size, 1);
  first();
  assert.equal(env.listeners.size, 1);
  second();
  assert.equal(env.listeners.size, 0);
  const remount = controller.subscribe(() => { updates++; });
  env.change(false);
  assert.equal(controller.getSnapshot().theme, "light");
  remount();
  assert.equal(env.listeners.size, 0);
});
