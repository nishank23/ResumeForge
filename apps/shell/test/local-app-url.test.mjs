import test from "node:test";
import assert from "node:assert/strict";
import { canonicalLocalAppUrl } from "../src/local-app-url.ts";

test("Docker's IP shell link uses the localhost auth origin", () => {
  assert.equal(canonicalLocalAppUrl("http://127.0.0.1:3000/"), "http://localhost:3000/");
});

test("canonicalization preserves deep links, encoded queries and fragments", () => {
  assert.equal(
    canonicalLocalAppUrl("http://127.0.0.1:3000/w/demo/resumes/resume-1?signed_in=1&next=%2Fprofile#projects"),
    "http://localhost:3000/w/demo/resumes/resume-1?signed_in=1&next=%2Fprofile#projects",
  );
});

test("canonicalization leaves approved localhost and unrelated deployments alone", () => {
  for (const href of [
    "http://localhost:3000/",
    "http://127.0.0.1:3001/",
    "http://127.0.0.1:4001/api/v1/auth/google/callback",
    "http://127.0.0.1/",
    "https://127.0.0.1:3000/",
    "http://[::1]:3000/",
    "https://forge.example/",
    "http://127.0.0.1.example:3000/",
  ]) {
    assert.equal(canonicalLocalAppUrl(href), null, href);
  }
});
