import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@resume-forge/shared/styles.css";
import { App } from "./App";
import { applyInitialTheme } from "./useThemePreference";
import { canonicalLocalAppUrl } from "./local-app-url";

const canonicalUrl = canonicalLocalAppUrl(window.location.href);
if (canonicalUrl) {
  // Redirect before mounting App so no session refresh uses the IP origin.
  window.location.replace(canonicalUrl);
} else {
  const root = document.getElementById("root");
  if (!root) throw new Error("Root element not found");

  applyInitialTheme();

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
