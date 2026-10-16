# Public cold-visit loading — 2026-10-15

Tested `https://resumeforge.sugarbuddyai.com/` in Chrome after clearing that origin's cookies, local/session storage, IndexedDB, cache storage and service workers. DevTools **Disable cache** bypassed the HTTP cache; network throttling was off. Other sites' data was not cleared. This is one before/after trial on this connection, not a global latency guarantee or a signed-in editor benchmark.

## Cause and change

The deployed HTML contained an empty React root. Federation discovered core shares through successive dynamic imports, each paying roughly 0.9 seconds of request latency. The React loader could not appear before this bootstrap completed. Gzip was already enabled; this did not require a larger VM.

- The initial fix used a static, accessible **Loading your workspace…** screen with inline styles and system fonts. The subsequent design update below keeps this early rendering and adds lightweight decorative motion.
- The shell build uses Vite's output graph to emit module-preload hints for core bootstrap dependencies. Fetching them early preserves their existing evaluation order. Lazy remote wrappers, the Tiptap editor and SSR entry loader remain excluded.
- The live release received only an HTML patch referencing its existing asset hashes, plus a preload hint for its existing main stylesheet. Its JavaScript, backend, database, credentials and machine size were preserved. The separate uncommitted tailoring work on organization `feature` was not deployed.

The Vite hook uses the installed Vite 6.4.3 types and output bundle. [Vite plugin documentation](https://vite.dev/guide/api-plugin.html#transformindexhtml) describes the HTML hook; [modulepreload](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/modulepreload) fetches modules without evaluating them. Recheck the graph exclusions when changing federation versions.

## Fresh evidence

| Measurement | Before | After |
| --- | --- | --- |
| First contentful paint | Not recorded in the initial load beacon; the early page was blank | 1.624 seconds, recorded by the page's performance beacon |
| Last startup JavaScript/CSS response, relative to navigation | 20.312 seconds | 10.004 seconds |
| Latest core bootstrap request start | 13.347 seconds | 2.544 seconds |
| Failed startup JavaScript/CSS responses | 0 | 0 |

The first exploratory Network panel reported 24.37 seconds overall. The comparable numbers above measure the same JavaScript/CSS boundary from the exported HAR files; they exclude fonts, recurring session checks and later telemetry. DOMContentLoaded/load occurred before the asynchronous app bootstrap and were not used as app-readiness evidence. Sign-in and its Google button appeared after the patched cold load. No Google sign-in or private resume operation was performed in this trial.

Source verification passed: production shell build, TypeScript, shell lint and all 18 shell tests. A build-artifact check verified 16 existing core module-preload targets and excluded lazy remotes, Tiptap and SSR. A temporary public-asset preview with 900 ms JavaScript delays displayed the static fallback and completed sign-in rendering with its API disabled. Its test-only origin mapping was never deployed.

Private, ignored evidence is retained in `.local/cold-load-20261015/`: sanitized before/after HAR files, timing summaries, the deployed HTML and first-screen/completed screenshots. DevTools HTTP-cache bypass was reset after testing.

## Deployment and rollback

The existing VM `resumeforge-demo` in `resume-forge-dev/us-central1-a` remains e2-micro. Its web image was replaced using `docker compose up --no-deps --no-build --pull never --force-recreate --wait web`. The app container ID, start timestamp, restart count and health were identical before and after. The local and public health endpoints returned OK. A transient public 502 was observed during the 13-second web replacement; the final public HTML returned 200 with the expected checksum.

- New image: `forge-studio-web:cold-start-20261015`, also tagged `forge-studio-web:cloud` for the existing Compose definition.
- Rollback image: `forge-studio-web:before-cold-start-20261015`.
- VM patch directory: `~/.resumeforge-cold-start-20261015`, mode 0700.
- Original HTML SHA-256: `83773374aedae2f1161be67256a5cf07c49fb89b9fd25eb115950e10aac345e8`.
- Deployed HTML SHA-256: `fb5c3c257c7082d8e56cbc319c8c073310444f81b73d425c65bfb717f980425e`.

To roll back, retag the rollback image as `forge-studio-web:cloud` and recreate only `web` with the same Compose definition and public origin. A future complete cloud build must include the shell HTML and Vite changes from this task; otherwise it will overwrite this web-only patch. Git source changes remain uncommitted on organization `feature`; no remote was pushed.

## Resume-system loading design — 2026-10-15

The first screen now shows an original inline SVG resume blueprint linked to Skills, Experience and an AI node. A single document scan, a coordinated node pulse and an indeterminate light strip provide motion. Product copy reads **Your story, taking shape.** The actual accessible status remains **Loading your workspace…**. These are decorative product illustrations, not claims that a visitor's resume is being analyzed or a model is running before sign-in.

The screen sits outside the React root and remains through bootstrap, session verification, empty navigation handoffs and federated sign-in loading. A small DOM observer removes it when real main content or a recovery/error screen renders. It then disconnects, removes its visibility listener and timer, and restores the root's accessibility and interaction. There is no minimum display duration. A reload link appears after 15 seconds if the app has not opened.

Device and saved app themes are respected. Reduced-motion CSS stops all four animated elements; a hidden document pauses decoration. The illustration uses no image downloads, external fonts, canvas, new dependency or provider request. The complete deployed HTML, including existing preload hints, is 19,965 bytes and compresses to approximately 4.7 KiB with gzip.

Verification:

- All 22 shell tests passed, including four new tests executing the real inline script. They cover bootstrap/session/empty redirects, immediate error and ready-page reveal, slow-load recovery, visibility pause and cleanup after first load.
- Shell TypeScript/lint and production build passed. The final built HTML retains the 16 existing core preload targets and lazy-feature exclusions.
- A temporary public-asset preview with 900 ms JavaScript delays reached sign-in. Light/dark and short-screen layouts were inspected. A mobile viewport override produced an effective 355×767 CSS viewport at the current browser scale; client and scroll dimensions matched without overflow. Temporary viewport override was reset.
- Chrome's real `prefers-reduced-motion: reduce` emulation returned `animation-name: none` for the scan, both halos and the light strip. The temporary preview tab was closed after the check.
- Public live verification showed the new loader, followed by the existing Google sign-in page. The loader was absent, the root was no longer inert, and `aria-hidden` was removed after the handoff. No Google sign-in or private resume operation was performed.
- The live HTML returned HTTP 200 with the expected checksum; public and VM-local health returned OK. The app container ID, start time, restart count and health matched the saved baseline. Only the web container was recreated; its health gate passed in 9.8 seconds.

Current image: `forge-studio-web:loader-20261015`, also tagged `forge-studio-web:cloud`. Immediate rollback image: `forge-studio-web:before-loader-20261015`. The VM patch directory is `~/.resumeforge-loader-20261015` (0700). Deployment automatically restores that rollback image if the web health gate fails. Current HTML SHA-256: `7fa9dcda635c411e7951593b72e48a46eb1a41bce0f95cd448110cf5a373edb9`.

The browser's file-upload flow closed its SSH session without leaving the file on the VM. Reconnection confirmed the prior HTML and missing upload; a compressed transfer through the authorized SSH terminal succeeded and its checksum was verified before building. No credential or private application data was transferred.

The earlier 20.312/10.004-second measurements describe the initial cold-load fix, not a new benchmark of this illustration. The current design adds no artificial wait; network and bootstrap latency still determine when sign-in is ready. Broad assistive-technology and cross-browser audits remain separate checks. Private evidence is in `.local/loading-screen-20261015/`. Source remains uncommitted on organization `feature`; no Git remote was pushed, and unrelated tailoring changes were not deployed.
