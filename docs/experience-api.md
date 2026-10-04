# Local Work Experience API

Verified bounded F04 prerequisites — 2026-10-04. GET/POST `/api/v1/profile/experience` and PUT `/api/v1/profile/experience/:id` use the existing verified actor, personal ownership, master revision and transactional audit. These slices do not connect the editor or implement deletion/reordering, other sections or onboarding completion.

## Contract

The profile must already exist. GET requires `profile.read` and returns `{ data: { profileId, revision, entries }, requestId }` in server append order (sortOrder, then ID). An empty section is valid. A scoped parent [share lock](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS) keeps the list and revision consistent with concurrent application writes. Lists are limited to 50 entries; an oversized or invalid legacy section fails closed with 503, never a silently truncated success.

POST requires `profile.update` and a positive `expectedRevision` below the PostgreSQL integer ceiling, plus nonblank company/title (trimmed, max 200 each). Optional location is nullable (max 200); dates are nullable year `YYYY` or month `YYYY-MM`, with valid four-digit years 1000–9999 and months 01–12. No timestamp/day/timezone coercion. An end requires a start; definitely reversed ranges reject (year-only values retain their precision rather than inventing months). `isCurrent` defaults false and requires a null end. Omitted optional fields default null; omitted bulletPoints default an empty list. Bullet points are user-supplied plain strings: at most 20 nonblank trimmed bullets, 1,000 characters each. No generated text or metrics.

The request schema is strict. IDs, profile/user/workspace ownership, sortOrder, revision, contacts, auth, completion, keywords/metrics/embeddings and unsupported rich-text/technology/employment/location-type fields cannot be mass-assigned. Each JSON body remains bounded to 32 KiB and a three-second read deadline. Query selectors and unsupported verbs/child paths reject; the optional workspace header must match verified ownership.

POST appends one server-ID entry, advances the parent revision once and returns 201 `{ data: { profileId, revision, entry }, requestId }`. It never completes or reopens setup and also permits ordinary professional edits on a completed master. The entry DTO contains only ID, company/title/location/dates/current flag/plain bullets/sortOrder. Legacy null bullet JSON projects as an empty list; invalid JSON fails closed. Parent IDs are server-derived and returned only for the owned profile.

Concurrent section/draft/full writes share the master revision; stale requests return 409 `revision_conflict`, with no child, revision or success audit change. A retry of a lost POST using the same revision cannot duplicate it: reload the list and reconcile before choosing another intentional add with the new revision. Identical employment facts can legitimately describe separate roles, so content is not a deduplication key. Capacity (50 entries or exhausted sort-order integer) returns 409 `section_limit`; the parent increment rolls back.

Success uses existing `profile.viewed` / `profile.updated`, parent profile resource and `{ permission: "profile.read", status: "experience_read" }` / `{ permission: "profile.update", status: "experience_added" }`. Snapshot/mutation and content-free audit capture commit together. No bullet/company/date/contact text or child content is logged. Auth expiry, denied scope and audit failures use the existing fixed error/no-store boundary. No migrations, new permissions/events, hosted database or broader grants are needed.

## Remaining integration

### Selected owned-entry update slice — 2026-10-04

PUT `/api/v1/profile/experience/:id` is implemented for an existing UUID entry beneath the authenticated owner's master. It requires `profile.update`, `expectedRevision` and all seven professional fields: company, title, nullable location/startDate/endDate, isCurrent and bulletPoints. It reuses the list/add bounds and precision/date rules; PUT replaces these fields explicitly, without optional defaults or partial-patch semantics. Null clears nullable fields and an empty bullet list clears bullets. IDs, ownership, order, keywords/metrics, contacts and completion remain forbidden in the body.

It returns 200 with the same `{ profileId, revision, entry }` projection as add. The entry's ID/order, other entries and non-editable stored metadata remain unchanged; the shared parent revision increments once. With a current revision, missing/foreign entries return the same 404, without changing the parent or adding a success event. The owned parent revision is checked before looking up the child, so stale writes return 409 regardless of the supplied target. Malformed IDs/fields/query selectors return 422. A failed audit COMMIT rolls back parent and child together. Existing `profile.updated` capture uses `{ permission: "profile.update", status: "experience_updated" }` on the owned parent only. Completed onboarding remains unchanged. Updates remain available at the 50-entry add limit. Retries must reload after a stale revision; no automatic overwrite or hidden last-write-wins behavior.

The canvas editor still uses its verified fictional in-memory draft. This API is for master professional facts, not a resume-version save or a rich-text/metadata mapping. Entry deletion/reorder, additional sections, gateway/browser integration, contact-safe resume headers/D12 and durable resume versions remain pending. AI, ATS, PDF and LinkedIn keep their existing gates. Next independently unblocked slice: bounded owned Education list/add under F04. Work Experience deletion/reorder require their own reviewed mutation/lifecycle contract before implementation.

## Verify locally

From the root, initialize/start local services as described in [profile API setup](profile-api.md#start-and-check), then in another terminal:

```bash
curl -i http://127.0.0.1:4002/api/v1/profile/experience
curl -i -X POST http://127.0.0.1:4002/api/v1/profile/experience \
  -H 'Content-Type: application/json' -d '{}'
curl -i -X PUT http://127.0.0.1:4002/api/v1/profile/experience/11111111-1111-4111-8111-111111111111 \
  -H 'Content-Type: application/json' -d '{}'
pnpm db:test:profile
```

All credential-free requests must return 401/no-store with a request ID and no data. The test command should print **44 passes**, zero failures: 22 professional-profile cases plus 22 Experience cases (21 scenarios and parent). It uses two independently disposable local databases and temporary restricted roles, not development users or hosted settings. Look for concurrent entry/add/draft saves, parent-lock snapshots/expiry, strict dates/mass assignment, foreign-target rejection, capacity, audit COMMIT rollback/retry and restricted HTTP ledger cases. No token copying or real profile seeding is required.

Authenticated request shape (illustrative user-supplied synthetic facts, not sample autofill):

```json
{
  "expectedRevision": 1,
  "company": "Example company",
  "title": "Example role",
  "startDate": "2023-01",
  "isCurrent": true,
  "bulletPoints": ["An accomplishment supplied by the user."]
}
```

For a deliberately authorized development account, GET the current master/section before adding; use its actual revision. Expect POST 201, one new stable ID and revision +1; subsequent GET must include the same entry. Repeating the old revision must return 409 with no duplicate. An end earlier than the start or a current role with an end must return 422; a foreign workspace selector must return 403 with no foreign data. Never put real access credentials in shell history/screenshots/Git. The automated suite exercises these authenticated checks safely with synthetic accounts.

For an intentional entry edit, use the ID and revision returned by GET, then send PUT with all seven professional fields. Example synthetic replacement:

```json
{
  "expectedRevision": 2,
  "company": "Example company",
  "title": "Updated user-supplied role",
  "location": null,
  "startDate": "2023-01",
  "endDate": null,
  "isCurrent": true,
  "bulletPoints": ["An updated accomplishment supplied by the user."]
}
```

Expect 200, unchanged ID/order and parent revision +1; GET reloads the replacement. Reusing the old revision returns 409. A missing or other owner's UUID with the current revision returns 404; omitting a field or submitting sortOrder/contact/ownership fields returns 422. The synthetic suite verifies these checks, including unchanged contacts, metadata, other entries and completion state.

Sign-in should still show the pending/incomplete setup entry for an incomplete account. The canvas editor continues its existing local-only behavior; clicking its Save does not call this API. Do not expect persistence in that UI yet.

2026-10-04 results: affected dependency build, profile lint/types, route tests **8/8** and database integration **38/38** pass (**46 cases**). First implementation run passed; no new test failure or infrastructure issue. Source formatting, test syntax, Markdown links/fences and diff checks pass. No schema/runtime grant/secrets changes, frontend/browser/live-provider checks or commit/push/deployment. Existing UTC connection correction and all completed editor work are preserved. Suggested commit: `feat: add revisioned work experience list and creation`.

2026-10-04 entry-update results: affected dependency build, profile lint/types, route tests **9/9** and database integration **44/44** pass (**53 cases**). Six new Experience scenarios plus extended capacity/audit/expiry/ledger coverage verify replacements and clears, field/ID validation, scoped missing/foreign targets, competing updates/add/draft writes, expiry during a blocked parent write and completed-profile metadata preservation. Audit failure rolls back both revision and child fields before a successful retry. First run passed; no new application issue found. Source formatting/syntax, Markdown links/fences and diff checks pass. No frontend/browser/live-provider verification, schema/runtime grants/secrets changes or commit/push/deployment. Suggested commit: `feat: add revisioned work experience updates`.
