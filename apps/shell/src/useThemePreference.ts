import { useLayoutEffect, useSyncExternalStore } from "react";
import { createThemePreference } from "./theme-preference";

let controller: ReturnType<typeof createThemePreference> | undefined;
function getController() {
  if (!controller) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      // Device theme remains available when browser storage is blocked.
    }
    controller = createThemePreference({
      storage,
      media: window.matchMedia("(prefers-color-scheme: dark)"),
    });
  }
  return controller;
}

export function applyInitialTheme() {
  document.documentElement.dataset.theme = getController().getSnapshot().theme;
}

export function useThemePreference() {
  const current = getController();
  const snapshot = useSyncExternalStore(current.subscribe, current.getSnapshot);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = snapshot.theme;
  }, [snapshot.theme]);
  return {
    ...snapshot,
    setPreference: current.setPreference,
    toggleTheme: () => {
      current.setPreference(snapshot.theme === "light" ? "dark" : "light");
    },
  };
}
