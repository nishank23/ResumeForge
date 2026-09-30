import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@resume-forge/shared/styles.css";
import { ProfileRemoteRoot } from "./ProfileRemoteRoot";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found in profile-mfe");
}

createRoot(rootEl).render(
  <StrictMode>
    <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)]">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h1 className="text-base font-bold">
            resume-forge · Standalone Profile Remote (Port 3002)
          </h1>
        </header>
        <ProfileRemoteRoot />
      </div>
    </main>
  </StrictMode>,
);
