import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioLoading, RemoteSuspenseFallback } from "../dist/index.js";

test("page loading announces complete status once and keeps decoration out of speech", () => {
  const html = renderToStaticMarkup(
    createElement(StudioLoading, {
      reducedMotion: true,
    }),
  );
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.match(html, /class="sr-only">Loading your workspace…/);
  assert.match(html, /rf-studio-loading-art" aria-hidden="true"/);
  assert.match(html, /data-reduced-motion="true"/);
  assert.doesNotMatch(html, /pui-wibble|role="progressbar"|[0-9]+%/);
});

test("all federated screens use generic loading copy and forward quiet mode", () => {
  for (const remoteName of ["auth-mfe", "profile-mfe", "resume-mfe"]) {
    const html = renderToStaticMarkup(
      createElement(RemoteSuspenseFallback, {
        remoteName,
        reducedMotion: true,
      }),
    );
    assert.match(html, /aria-label="Loading your workspace"/);
    assert.doesNotMatch(html, /Opening|resume editor/);
    assert.match(html, /data-reduced-motion="true"/);
    assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  }
});
