import type { ThemeMode } from "@resume-forge/shared";

export type ThemePreference = "system" | ThemeMode;
export const THEME_STORAGE_KEY = "resume-forge:theme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type DeviceTheme = Pick<
  MediaQueryList,
  "matches" | "addEventListener" | "removeEventListener"
>;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function createThemePreference({
  storage,
  media,
}: {
  storage?: ThemeStorage;
  media?: DeviceTheme;
}) {
  let preference: ThemePreference = "system";
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) preference = stored;
  } catch {
    // Restricted browser storage must not prevent rendering.
  }
  const resolve = (): ThemeMode =>
    preference === "system" ? (media?.matches ? "dark" : "light") : preference;
  let snapshot = { preference, theme: resolve() };
  const listeners = new Set<() => void>();
  const update = () => {
    const theme = resolve();
    if (snapshot.preference === preference && snapshot.theme === theme) return;
    snapshot = { preference, theme };
    listeners.forEach((listener) => {
      listener();
    });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      if (!listeners.size) media?.addEventListener("change", update);
      listeners.add(listener);
      // Catch device changes between render and subscription.
      update();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) media?.removeEventListener("change", update);
      };
    },
    setPreference: (next: ThemePreference) => {
      preference = next;
      try {
        if (next === "system") storage?.removeItem(THEME_STORAGE_KEY);
        else storage?.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // The current visit still works when persistence is unavailable.
      }
      update();
    },
  };
}
