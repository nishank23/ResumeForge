# Error and Fix Log

## Current audit snapshot — 2026-10-11

Dated errors and test/dependency counts describe historical checkpoints. Current discrepancies and fresh validation belong in docs/implementation-audit.md; historical fixes do not establish full current release acceptance.

[Implementation audit](../docs/implementation-audit.md) provides completion checklists, source, gaps and priorities. Dated observations and original target designs below remain historical evidence or future acceptance.

**Last updated:** 2026-10-02

**Purpose:** Canonical register of technical, build, type, and runtime errors encountered during `resume-forge` implementation, their root causes, exact fixes applied, and current verification status.

---

## Summary Table

| ID  | Phase / Task                       | Error Summary                                                                                                                                                                                                                                             | Category                            | Status               |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------- |
| E01 | P1.1 Scaffold                      | `typescript@^7.0.0` does not exist on npm registry (source doc typo for `Prisma 7`)                                                                                                                                                                       | Dependency / Toolchain              | **Fixed & Verified** |
| E02 | P1.2 Shared UI                     | `TS4032` in `vite-plugin-dts` when re-exporting `GlassCard.Icon` / `Title` / `Body` / `Link` from `performative-ui@0.7.0`                                                                                                                                 | TypeScript / Declaration Rollup     | **Fixed & Verified** |
| E03 | P1.2 Shared UI                     | `performative-ui/styles.css` sets `.pui-node-graph { pointer-events: auto }`, intercepting clicks over application content                                                                                                                                | CSS / Accessibility Isolation       | **Fixed & Verified** |
| E04 | P1.2 Build                         | Relative `paths` in `tsconfig.base.json` caused `vite-plugin-dts` to emit broken `../../../packages/shared-types/src` imports in `packages/shared/dist/index.d.ts`                                                                                        | TypeScript / Monorepo Exports       | **Fixed & Verified** |
| E05 | P1.2 Shell Typecheck               | `TS2307: Cannot find module 'auth_mfe/AuthRemoteRoot'` because top-level `import`/`export` in `apps/shell/src/remotes.d.ts` turned the ambient declaration file into a module                                                                             | TypeScript / Module Federation      | **Fixed & Verified** |
| E06 | P1.2 Runtime / Dev Server          | Browser white screen on `http://localhost:3000`: `ERR_CONNECTION_REFUSED` on `3001`–`3003/remoteEntry.js` and `Failed to fetch dynamically imported module: .../__H_A_I__hostAutoInit__H_A_I__.js`                                                        | Vite Dev Server / Module Federation | **Fixed & Verified** |
| E07 | P1.2 Shell Error Boundary UX       | `Remote Failure Active` (`Synthetic federation error: resume-mfe bundle failed to respond...`) could not be recovered via the in-card `Retry loading resume-mfe` button and persisted across route tab navigation (e.g., `/w/ws-personal-01/resumes/new`) | Error Boundary / State Recovery     | **Fixed & Verified** |
| E08 | P1.2 Performative UI Accessibility | Chrome DevTools reported `No label associated with a form field` and `A form field element should have an id or name attribute` on `performative-ui`'s internal `<PromptHero>` and `<Prompt>` inputs                                                      | Accessibility / Third-Party Wrapper | **Fixed & Verified** |

---

## Detailed Error Records

### E01 — Non-existent `typescript@^7.0.0` in source baseline

- **When encountered:** Phase 1, Task P1.1 (Toolchain validation).
- **Symptom:** Source documentation referred to `TypeScript 7` alongside `Prisma 7`. Querying the npm registry confirmed TypeScript's latest stable release is `5.9.3` (`5.8.x` / `5.9.x`), while `Prisma 7` is the ORM version.
- **Root cause:** Documentation typo conflating Prisma 7 with TypeScript 7.
- **Fix applied:** Pinned `typescript` to `^5.8.3` (resolving to `5.9.3`) across `tsconfig.base.json` and workspace `package.json` manifests; recorded the version note in `context/progress-tracker.md`.
- **Status:** **Fixed & Verified** (`pnpm check` passes across all packages).

---

### E02 — `TS4032` declaration rollup failure on `performative-ui` `GlassCard` subcomponents

- **When encountered:** Phase 1, Task P1.2 (`@resume-forge/shared` build).
- **Symptom:** Running `pnpm --filter @resume-forge/shared build` failed during `vite-plugin-dts` declaration rollup with:
  `error TS4032: Property 'Icon' of exportedando function has or is using name 'GlassCardIconProps' from external module ".../performative-ui/dist/index" but cannot be named.`
- **Root cause:** `performative-ui@0.7.0` attaches `Icon`, `Title`, `Body`, and `Link` to `GlassCard` in `performative-ui/dist/index.d.ts` without exporting their prop interfaces (`GlassCardIconProps`, `GlassCardTitleProps`, `GlassCardBodyProps`, `GlassCardLinkProps`). Directly assigning `GlassCardSurface.Icon = GlassCard.Icon` caused TypeScript's declaration emitter to fail when serializing the inferred type.
- **Fix applied:** Created explicitly typed wrapper components (`GlassCardIcon`, `GlassCardTitle`, `GlassCardBody`, `GlassCardLink`) in `packages/shared/src/components/ui/performative-wrappers.tsx` with exported prop types (`GlassCardIconWrapperProps`, etc.) and attached those to `GlassCardSurface`.
- **Status:** **Fixed & Verified** (`vite-plugin-dts` generates `packages/shared/dist/index.d.ts` with 0 errors).

---

### E03 — `NodeGraphBackground` pointer-event capture in `performative-ui`

- **When encountered:** Phase 1, Task P1.2 (Performative UI CSS audit).
- **Symptom:** `performative-ui/dist/performative-ui.css` defines `.pui-node-graph { pointer-events: auto; }`, which can intercept mouse clicks or touch events meant for foreground workspace controls.
- **Root cause:** Upstream library enables canvas mouse-gravity interaction by default via `pointer-events: auto`.
- **Fix applied:** Added `.rf-decorative-layer, .rf-decorative-layer * { pointer-events: none !important; user-select: none !important; }` in `packages/shared/src/styles/styles.css` and wrapped `AuroraBackdrop`, `NodeGraphBackdrop`, and `SparkleFieldAccent` in `.rf-decorative-layer` with `aria-hidden="true"`.
- **Status:** **Fixed & Verified**.

---

### E04 — Broken relative imports in rolled-up `packages/shared/dist/index.d.ts`

- **When encountered:** Phase 1, Task P1.2 (workspace `pnpm build`).
- **Symptom:** `apps/resume-mfe` failed typechecking because `packages/shared/dist/index.d.ts` contained `import { ResumeSectionProposal } from '../packages/shared-types/src'`, which did not resolve from `packages/shared/dist/`.
- **Root cause:** `tsconfig.base.json` contained root-relative `"paths"` (`"@resume-forge/shared-types": ["./packages/shared-types/src"]`), causing `vite-plugin-dts` to rewrite package imports into broken relative filesystem paths during declaration rollup.
- **Fix applied:** Removed redundant `"paths"` from `tsconfig.base.json` (relying on standard `pnpm` workspace symlinks and `package.json` `exports` with `moduleResolution: "bundler"`) and configured `bundledPackages: ["@resume-forge/shared-types"]` in `packages/shared/vite.config.ts`.
- **Status:** **Fixed & Verified** (`pnpm build` and `pnpm check` pass across all 7 workspace packages).

---

### E05 — `TS2307` on federated remote imports (`auth_mfe/AuthRemoteRoot`, etc.)

- **When encountered:** Phase 1, Task P1.2 (`@resume-forge/shell` typecheck).
- **Symptom:** `apps/shell/src/App.tsx` failed with `TS2307: Cannot find module 'auth_mfe/AuthRemoteRoot' or its corresponding type declarations`.
- **Root cause:** `apps/shell/src/remotes.d.ts` had top-level `import type` and `export interface` statements outside the `declare module "..."` blocks, which caused TypeScript to treat `remotes.d.ts` as an ES module rather than a global ambient module declaration file.
- **Fix applied:** Moved `import type` statements inside each `declare module "..."` block in `apps/shell/src/remotes.d.ts` so the file remains an ambient declaration file.
- **Status:** **Fixed & Verified**.

---

### E06 — Browser white screen on `http://localhost:3000`: `ERR_CONNECTION_REFUSED` (`3001`–`3003`) & `hostAutoInit` dynamic import failure

- **When encountered:** Phase 1, Task P1.2 (manual browser check on `http://localhost:3000`).
- **Symptom:** Opening `http://localhost:3000` in Chrome showed a blank white screen with console errors:
  1. `GET http://localhost:3000/@vite/client net::ERR_ABORTED 404 (Not Found)`
  2. `GET http://localhost:3001/remoteEntry.js net::ERR_CONNECTION_REFUSED`
  3. `GET http://localhost:3002/remoteEntry.js net::ERR_CONNECTION_REFUSED`
  4. `GET http://localhost:3003/remoteEntry.js net::ERR_CONNECTION_REFUSED`
  5. `Uncaught (in promise) TypeError: Failed to fetch dynamically imported module: http://localhost:3000/@id/virtual:mf:__mfe_internal__shell__mf_owner__1__H_A_I__hostAutoInit__H_A_I__.js`
- **Root causes (3 combined factors discovered via Vite middleware inspection):**
  1. **Mid-flight Vite `optimizeDeps` invalidation (`504 Outdated Optimize Dep`):** Because `performative-ui` is a dependency inside the workspace-linked `@resume-forge/shared` package rather than a direct import in `apps/shell/src`, Vite's initial scanner did not pre-bundle `performative-ui` at server startup. When `hostAutoInit` loaded `localSharedImportMap` → `packages/shared/dist/index.js`, Vite discovered `performative-ui` mid-flight (`✨ new dependencies optimized: performative-ui. ✨ optimized dependencies changed. reloading`), invalidating the `.vite/deps` hash while `hostAutoInit` was still loading.
  2. **HTML-mode `add-entry` transform & eager remote prefetch in `@module-federation/vite@1.22.1`:** With the default `shareStrategy: "version-first"` and `hostInitInjectLocation: "html"`, `@module-federation/vite` injected eager `import("http://localhost:3001/remoteEntry.js")`, `3002`, and `3003` prefetch calls at the top of the HTML entry bootstrap before React mounted, and could also inject `mf-entry-bootstrap` into non-`node_modules` workspace files (`packages/shared/dist/index.js`) if transformed before `index.html`.
  3. **Remote dev servers (`3001`–`3003`) not running / stale P1.1 server on port `3000`:** Running only the shell server (or keeping an old P1.1 server process on port `3000`) left ports `3001`, `3002`, and `3003` offline (`ERR_CONNECTION_REFUSED`), and `turbo.json`'s `dev` task lacked `"dependsOn": ["^build"]`.
- **Fixes applied:**
  1. Added `optimizeDeps: { include: ["lucide-react", "@resume-forge/shared > performative-ui"] }` to `apps/shell/vite.config.ts`, `apps/auth-mfe/vite.config.ts`, `apps/profile-mfe/vite.config.ts`, and `apps/resume-mfe/vite.config.ts` so Vite pre-bundles `performative-ui` upfront at startup and never invalidates `.vite/deps` mid-request.
  2. Configured `filename: "remoteEntry.js"`, `shareStrategy: "loaded-first"`, and `hostInitInjectLocation: "entry"` in `federation({...})` across `shell`, `auth-mfe`, `profile-mfe`, and `resume-mfe`. This eliminates eager remote prefetching at HTML boot and restricts `hostAutoInit` injection strictly to `src/main.tsx`.
  3. Added `createRetryableLazy` in `apps/shell/src/App.tsx` and updated `RemoteLoadFallback` in `packages/shared/src/components/ui/remote-boundary.tsx` so that if a remote server (`3001`–`3003`) is offline, the shell still mounts cleanly, renders `RemoteLoadFallback`, and can retry the dynamic import once the remote comes online.
  4. Added `"dependsOn": ["^build"]` to the `"dev"` task in `turbo.json` so running `pnpm dev` always builds `@resume-forge/shared-types` and `@resume-forge/shared` before starting the dev servers.
- **Status:** **Fixed & Verified** (`pnpm build`, `pnpm check`, and Vite middleware crawl pass without mid-flight re-optimization or bootstrap corruption).

---

### E07 — `Remote Failure Active` (`Synthetic federation error`) unrecoverable via in-card `Retry loading` button and persisted across route tab clicks

- **When encountered:** Phase 1, Task P1.2 (manual browser verification on `http://localhost:3000/w/ws-personal-01/resumes/new`).
- **Symptom:** When the top-bar diagnostic button **`Simulate Remote Failure`** was clicked (turning red as **`Remote Failure Active`**), the active federated route displayed:
  `Microfrontend Remote Unavailable: resume-mfe — Synthetic federation error: resume-mfe bundle failed to respond or threw during render.`
  Subsequently:
  1. Clicking the **`Retry loading resume-mfe`** button inside the error card did not recover the microfrontend—it immediately threw the synthetic error again.
  2. Clicking another navigation tab (such as **`New Resume Intent PromptHero`** at `/w/ws-personal-01/resumes/new`) stayed trapped in the simulated failure state instead of opening the route.
  3. The fallback card displayed the generic `Ensure all federated dev servers are running from the workspace root via pnpm dev (ports 3000–3003)` message even when the error was a synthetic test failure, making it look like port `3003` was actually down.
- **Root cause:** `RemoteErrorBoundary.handleRetry` in `packages/shared/src/components/ui/remote-boundary.tsx` only reset its internal `hasError` state without invoking a parent `onRetry` callback to clear `simulateRemoteFailure` in `apps/shell/src/App.tsx`. Because `simulateRemoteFailure` remained `true`, `FederatedRemoteSlot` immediately rendered `<CrashingRemoteSimulator>` again on retry and across route changes.
- **Fixes applied:**
  1. Added `onRetry?: () => void` to `RemoteErrorBoundaryProps` in `packages/shared/src/components/ui/remote-boundary.tsx` and invoked `this.props.onRetry?.()` inside `handleRetry` before clearing `hasError`.
  2. Updated `RemoteLoadFallback` in `packages/shared/src/components/ui/remote-boundary.tsx` to distinguish synthetic test failures (`Simulated Failure Mode`) from real network/server errors.
  3. Updated `ShellRouterRoot`, `ShellLayout`, and `FederatedRemoteSlot` in `apps/shell/src/App.tsx` to pass `onClearSimulateFailure` to `RemoteErrorBoundary` and to automatically reset `simulateRemoteFailure` to `false` when navigating between routes.
- **Status:** **Fixed & Verified** (verified live in Chrome via Chrome DevTools MCP: clicking `Simulate Remote Failure` and then `Retry loading resume-mfe` or switching routes immediately restores the federated microfrontend).

---

### E08 — Chrome DevTools form-field accessibility warnings on `performative-ui` `<PromptHero>` and `<Prompt>` inputs

- **When encountered:** Phase 1, Task P1.2 (Chrome DevTools MCP console/issue inspection on `/w/ws-personal-01/resumes/new`).
- **Symptom:** Chrome DevTools reported two accessibility/autofill issues when `resume-mfe` rendered `ResumeIntentPrompt` and `ResumeSectionPrompt`:
  1. `[issue] No label associated with a form field (count: 1)`
  2. `[issue] A form field element should have an id or name attribute (count: 2)`
- **Root cause:** Upstream `performative-ui@0.7.0` renders an internal `<input>` inside `<PromptHero>` and an internal `<textarea>` inside `<Prompt>` without exposing `id`, `name`, or `aria-labelledby` props on the component interface.
- **Fix applied:** Attached container refs (`promptHeroContainerRef` and `promptContainerRef`) and `useEffect` hooks in `ResumeIntentPrompt` and `ResumeSectionPrompt` (`packages/shared/src/components/ui/performative-wrappers.tsx`) that automatically stamp deterministic `id`, `name`, `aria-labelledby`, and `aria-describedby` / `aria-label` attributes onto the underlying `<input>` and `<textarea>` DOM nodes, and linked `<label htmlFor={inputId}>`.
- **Status:** **Fixed & Verified** (verified via Chrome DevTools MCP `list_console_messages` and accessibility tree snapshot: `0` console errors, `0` warnings, `0` DevTools form-field issues).

### E09 — Missing app utilities and crowded preview workflow

Browser review found app-level utility classes missing from the shared Tailwind output, developer tools in normal navigation, and creation plus editing combined on one page. Added an explicit app source scan and matching shared-package Turbo inputs, separated the routes, and replaced simulated persistence/AI status claims with sample labels. Production screens were reviewed on 2026-09-30.

### E10 — Mobile creation button clipping and tablet wordmark wrap

At 390px, the upstream inline PromptHero input/button overflowed its clipped panel. The shared wrapper stylesheet now stacks those controls on narrow screens. At 800px, the wordmark wrapped in the narrower sidebar; adjusted its spacing and prevented wrapping. See the latest [verification record](../docs/ui-redesign-review.md).

### E11 — Optional telemetry skipped audit worker delivery

- **Phase/task:** P1.3 automatic local audit relay.
- **Symptom:** Workers without an onBatch callback polled without executing the delivery batch; a fake-clock database test stalled.
- **Cause:** `onBatch?.(await runBatch())` skips argument evaluation when the optional callback is absent.
- **Fix:** Await `runBatch()` unconditionally, then call the optional observer. Added an explicit no-observer regression case. Interrupted tests were stopped and the verified synthetic database/temporary roles were removed; no development data was reset.
- **Verification:** Worker/unit tests pass; disposable restricted-role tests pass scheduled delivery and restart/lease recovery. `pnpm check` and `pnpm test` pass. **Fixed and verified.**
