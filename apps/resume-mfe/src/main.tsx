import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@resume-forge/shared/styles.css";
import { ResumeRemoteRoot } from "./ResumeRemoteRoot";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found in resume-mfe");
}

createRoot(rootEl).render(
  <StrictMode>
    <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h1 className="text-base font-bold">
            resume-forge · Standalone Resume Remote (Port 3003)
          </h1>
        </header>
        <ResumeRemoteRoot />
      </div>
    </main>
  </StrictMode>,
);
