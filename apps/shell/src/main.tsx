import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@resume-forge/shared/styles.css";
import { App } from "./App";
import { applyInitialTheme } from "./useThemePreference";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

applyInitialTheme();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
