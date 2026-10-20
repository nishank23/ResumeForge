# Live cloud concurrency checks — 2026-10-14

## Result

Five simultaneous API users completed normal work without failures. Ten users had two failed list requests and only eight completed all six edit/save cycles. Simultaneous PDF export, PDF parsing and AI rewrite are not reliable for five or ten users: each implementation admits at most two operations, and excess requests receive HTTP 503. The ten-user PDF/upload sequence also produced late failures during high I/O wait. No app restart or cgroup OOM kill was recorded.

## Workload and scope

- Target: live `https://resumeforge.sugarbuddyai.com`, e2-micro (964 MiB physical RAM), 1 GiB swap, 30 GB standard boot disk. Application source: `8fc9208`.
- Client: Mac HTTPS API virtual users, separate from the VM. Ten isolated synthetic accounts/workspaces used normal live refresh and actor authorization. A private in-process fixture issuer created the synthetic persistent sessions; real Google OAuth concurrency and simultaneous browser rendering were not tested. No public auth bypass or production configuration change was added.
- Six list/load/save/readiness cycles per active user with 500 ms think time. Each fictional document was approximately 13,233 bytes in its API representation, with two experience entries, two projects and 18 bullets. The baseline saved PDF was 23,450 bytes. This is a short burst test, not a soak test or a maximum-size upload test.
- PDF, upload and AI were separate synchronized bursts. The ten-user upload burst immediately followed the PDF burst. Ten-user AI ran after recovery. Uploads used successful fictional saved PDFs; users whose PDF export was rejected used the known-valid baseline PDF. Parsing does not persist a reviewed import.
- AI attempted 15 scoped requests in total. Four succeeded; the remaining eleven failed with the app's concurrency guard. Only fictional professional summary text was eligible for provider transmission; proposals were not applied.
- A preliminary fixture request returned 422 because the temporary harness included an extra legacy-section field. The corrected fixture passed the actual editor and create API schemas. This setup error is excluded from the load results.
- The harness initially stopped on excessive failures. After confirming the existing two-operation guards, remaining scenarios ran separately with fresh sessions on the same ten accounts. Failures are retained below; no retries conceal them.

## Measured responses

Successful p95 values exclude failed responses. For heavy bursts, only one or two successes exist; these percentiles describe this sample, not a reliable population estimate. Normal rows exclude static assets, auth refresh/identity and health probes.

| Users | Operation | Successful / attempted | Successful p95 | HTTP responses |
|---|---|---|---|---|
| 5 | List/load/save/readiness | 120/120 | 0.681 s | 200: 120 |
| 5 | PDF export | 2/5 | 10.027 s | 200: 2, 503: 3 |
| 5 | PDF upload/parse | 2/5 | 4.822 s | 200: 2, 503: 3 |
| 5 | Scoped AI rewrite | 2/5 | 2.624 s | 200: 2, 503: 3 |
| 10 | List/load/save/readiness | 192/194 | 1.009 s | 200: 192, 503: 2 |
| 10 | PDF export | 1/10 | 28.101 s | 200: 1, 503: 9 |
| 10 | PDF upload/parse | 0/10 | — | 422: 3, 503: 7 |
| 10 | Scoped AI rewrite | 2/10 | 2.507 s | 200: 2, 503: 8 |

Five-user ordinary requests had p50 380 ms and max 1,037 ms. Ten-user ordinary successful requests had p50 373 ms; the two failed list requests returned 503 after 3,594 and 3,698 ms. Two of ten user flows stopped at those failures, so the ten-user run made 194 normal requests rather than 240.

Five-user PDF successes took 8.03–10.03 seconds; three other requests failed quickly. Ten-user PDF export returned eight quick 503s, one late 503 after 28.10 seconds, and one successful PDF after 28.10 seconds. Ten-user upload returned seven 503s and three 422 `invalid_input` errors, taking 15.53–24.39 seconds. The upload data came from valid server-rendered PDFs that passed signature/version checks and prior parsing.

## Resource evidence

A lightweight VM monitor sampled the app cgroup and host once per second. Every measured phase has samples. Across these phases, sampled app resident/cached memory peaked at **487.9 MiB**, app swap at **429.3 MiB**, and host swap at **573.7 MiB**. Minimum host available RAM was **83.6 MiB**. The app's 640 MiB limit was not hit; `memory.events` reported zero max/OOM/OOM-kill events. Sampled I/O wait reached **96.9%**; CPU steal peaked at **0.5%**.

All **35 health probes** returned 200. Final Docker inspection showed healthy, zero restarts and `OOMKilled=false`. Successful health probes do not imply that business requests succeeded.

## Confirmed limits and inference

- `services/resume-service/src/pdf.ts:7` rejects a third active PDF operation. Its worker budget is 25 seconds.
- `services/resume-service/src/upload.ts:33` rejects a third active upload parse. Its worker budget is 8 seconds; timeout/error/worker exit share a generic invalid-input result.
- `services/resume-service/src/ats/ai.ts:48` rejects a third active provider operation. The AI burst failures therefore do not establish a Gemini quota failure.
- High I/O wait and active swap are measured. They are consistent with memory paging/disk contention contributing to late worker and list failures. The exact cause of each generic 503/422 was not instrumented; no database timeout, role grant or memory limit was changed.

Keep the protective bounds. A fair bounded queue/backpressure flow and memory/I/O tuning are needed before promising five or ten simultaneous heavy operations. Raising RAM alone would not remove the explicit two-operation guards. No product fix or infrastructure upgrade is included in this validation task.

## Integrity and cleanup

Successful saves/reloads retained the expected owner name and immutable version. Five deliberate cross-owner reads returned 404. Existing real-user resumes, local private configuration and the local database were not changed by the harness.

Every test account's active resumes were soft-deleted through the owned APIs. A scoped restricted-role check verified exactly ten synthetic users, zero active test resumes and zero unrevoked test sessions. It also revoked one session whose earlier logout had failed during the heavy burst. Synthetic account/profile rows, soft-deleted versions and sanitized audit history remain isolated; they were not permanently purged. Resource monitors were stopped.

Temporary scripts and metric reports are under `/private/tmp/resumeforge-load-20261014/`. The raw VM resource traces remain in its private load-test staging directory. Credentials and the temporary transfer private key are excluded from Git and removed after verification. No temporary Google Cloud CLI login was used.
