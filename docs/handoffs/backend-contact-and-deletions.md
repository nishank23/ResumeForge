# Backend Handoff: UserContact Persistence, Section Entry Deletions, and Onboarding Completion

- **Task**: UserContact persistence, section entry deletions, and onboarding completion under F04.
- **Branch**: `codex/backend`
- **Date**: 2026-10-04

---

## 1. Overview & Summary of Changes

Implemented `UserContact` persistence, section entry deletions across all 5 profile sections (`experience`, `education`, `skills`, `projects`, `certifications`), onboarding completion, and least-privilege PostgreSQL database grants:

1. **UserContact Persistence**:
   - `GET /api/v1/profile/contact`: Authorized via `profile.read`. Returns scoped contact facts (`email`, `phone`, `address`, `linkedinUrl`, `githubUrl`, `portfolioUrl`, `updatedAt`). When not yet initialized in the database, returns default null values with a stable profile link. Strictly separates contact details from `UserProfile` facts (`fullName`, `location`, `professionalSummary`, `revision`), ensuring contact email is independent of user account email and never exposed on `GET /api/v1/profile`.
   - `PUT /api/v1/profile/contact`: Authorized via `profile.update`. Upserts contact facts into `UserContact` linked to `profileId`. Strictly validates allowlisted fields (`email` max 200, `phone` max 50, `address` max 200, URLs max 500), rejects invalid email/URL formats and unknown properties (mass assignment) with 422 `invalid_input`. Commits transactional audit logging with `action: profile.updated` and `status: contact_updated`. Does not mutate `UserProfile.revision`.

2. **Section Entry Deletions**:
   - `DELETE /api/v1/profile/<section>/:id` across all 5 sections (`experience`, `education`, `skills`, `projects`, `certifications`).
   - Authorized via `profile.update`.
   - Validates `expectedRevision` from either JSON body (`{ "expectedRevision": <number> }`) or `X-Expected-Revision` header.
   - Enforces optimistic concurrency by locking and incrementing `UserProfile.revision` where `revision == expectedRevision`. Stale revisions return 409 `revision_conflict` without deleting the record.
   - Strictly scopes deletion to the authenticated owner's profile (`where: { id: entryId, profileId, profile: { userId } }`). Missing or foreign entries return 404 `not_found`.
   - Emits transactional audit logging with `status: <section>_deleted` (`experience_deleted`, `education_deleted`, `skill_deleted`, `project_deleted`, `certification_deleted`).
   - Returns 200 with `{ profileId, revision, deletedEntryId }`.

3. **Onboarding Completion**:
   - `POST /api/v1/profile/complete`: Authorized via `profile.update`.
   - Validates `expectedRevision` from JSON body (`{ "expectedRevision": <number> }`).
   - Checks that onboarding is not already complete (`onboardingCompletedAt === null`); otherwise rejects with 409 `onboarding_complete`.
   - Sets `onboardingCompletedAt = new Date()`, increments `UserProfile.revision`, and writes transactional audit outbox entry with `status: onboarding_completed`.
   - Subsequent `PUT /api/v1/profile/draft` requests on completed profiles correctly fail with 409 `onboarding_complete`.

4. **Runtime Role Security & DB Permissions**:
   - Updated `packages/prisma-client/src/runtime-access.ts` to include `DELETE` privilege in `RuntimeGrant`.
   - Granted table-level `DELETE` on child section tables (`Education`, `Experience`, `Skill`, `UserProject`, `Certification`) to the restricted `profile` service database role.
   - Enforced in `assertRuntimeDatabaseRole` that `DELETE` is only granted on approved child tables and forbidden on all other tables (`UserProfile`, `UserContact`, `Workspace`, `User`, `OAuthAccount`, `Session`, `AuditOutbox`, `AuditEvent`), while `TRUNCATE,TRIGGER,MAINTAIN` remain forbidden cluster-wide.

---

## 2. API Contract Specification

### `GET /api/v1/profile/contact`
- **Method**: `GET`
- **Permission**: `profile.read`
- **Response**: `200 OK`
```json
{
  "data": {
    "id": "UUID",
    "profileId": "UUID",
    "email": "alice.contact@example.com",
    "phone": "+1-555-0123",
    "address": "123 Tech Lane, San Francisco, CA",
    "linkedinUrl": "https://linkedin.com/in/alice-dev",
    "githubUrl": "https://github.com/alice-dev",
    "portfolioUrl": "https://alice.dev",
    "updatedAt": "2026-10-04T18:00:00.000Z"
  },
  "requestId": "UUID"
}
```

### `PUT /api/v1/profile/contact`
- **Method**: `PUT`
- **Permission**: `profile.update`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "email": "alice.contact@example.com",
  "phone": "+1-555-0123",
  "address": "123 Tech Lane, San Francisco, CA",
  "linkedinUrl": "https://linkedin.com/in/alice-dev",
  "githubUrl": "https://github.com/alice-dev",
  "portfolioUrl": "https://alice.dev"
}
```
- **Response**: `200 OK` (returns updated `UserContactDto` as above).

### `DELETE /api/v1/profile/<section>/:id`
- **Sections**: `experience`, `education`, `skills`, `projects`, `certifications`
- **Method**: `DELETE`
- **Permission**: `profile.update`
- **Headers**:
  - `Content-Type: application/json` (when body provided), or `X-Expected-Revision: <number>`
- **Body** (optional if header supplied):
```json
{
  "expectedRevision": 2
}
```
- **Response**: `200 OK`
```json
{
  "data": {
    "profileId": "UUID",
    "revision": 3,
    "deletedEntryId": "UUID"
  },
  "requestId": "UUID"
}
```

### `POST /api/v1/profile/complete`
- **Method**: `POST`
- **Permission**: `profile.update`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "expectedRevision": 3
}
```
- **Response**: `200 OK`
```json
{
  "data": {
    "id": "UUID",
    "onboardingCompletedAt": "2026-10-04T18:05:00.000Z",
    "revision": 4
  },
  "requestId": "UUID"
}
```

---

## 3. Verification & Test Results

1. **Unit & Route Tests**:
   - `node --test services/profile-service/test/route.test.mjs`
   - **Result**: `16/16` tests pass.
   - Covers dispatch, local CORS, expected-revision parsing from body or header, and invalid input rejection.

2. **Integration Database Tests**:
   - `node --test services/profile-service/test/contact-and-deletions.test.mjs`
   - **Result**: `12/12` tests pass against real PostgreSQL database.
   - `pnpm --filter @resume-forge/profile-service test:db`
   - **Result**: `105/105` tests pass across `profile`, `experience`, `education`, `skill`, `project`, `certification`, and `contact-and-deletions`.

3. **Runtime Roles Tests**:
   - `node --test services/workspace-service/test/runtime-roles.test.mjs`
   - **Result**: `12/12` tests pass.
   - `pnpm --filter @resume-forge/prisma-client test:db`
   - **Result**: `14/14` tests pass.

4. **Monorepo Typecheck & Lint**:
   - `pnpm typecheck` -> 19/19 packages clean.
   - `pnpm --filter @resume-forge/profile-service lint` -> clean.

---

## 4. Manual Verification Steps

1. **Start the Database Cluster & Services**:
   ```bash
   pnpm db:cluster:start
   pnpm --filter @resume-forge/auth-service dev
   pnpm --filter @resume-forge/profile-service dev
   ```

2. **Authenticate & Obtain Access Token**:
   - Follow the OAuth flow on `http://localhost:4001/api/v1/auth/google/url`.
   - Note the returned access token `TOKEN` and user's personal workspace ID `WORKSPACE_ID`.

3. **Verify Contact GET & PUT**:
   ```bash
   # Get contact (returns default null fields initially)
   curl -s -X GET http://localhost:4002/api/v1/profile/contact \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID"

   # Put contact facts
   curl -s -X PUT http://localhost:4002/api/v1/profile/contact \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "dev.user@example.com",
       "phone": "+1-555-0100",
       "address": "San Francisco, CA",
       "linkedinUrl": "https://linkedin.com/in/devuser",
       "githubUrl": "https://github.com/devuser",
       "portfolioUrl": "https://devuser.dev"
     }'

   # Verify master profile does NOT expose contact facts
   curl -s -X GET http://localhost:4002/api/v1/profile \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID"
   ```

4. **Verify Section Deletions with Revision Control**:
   ```bash
   # Get current revision
   REV=$(curl -s -X GET http://localhost:4002/api/v1/profile \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID" | jq .data.revision)

   # Add a skill
   SKILL_ID=$(curl -s -X POST http://localhost:4002/api/v1/profile/skills \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d "{\"expectedRevision\": $REV, \"name\": \"Go\", \"category\": \"Languages\", \"proficiency\": \"advanced\"}" | jq -r .data.entry.id)

   # Delete the skill
   NEXT_REV=$((REV + 1))
   curl -s -X DELETE "http://localhost:4002/api/v1/profile/skills/$SKILL_ID" \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d "{\"expectedRevision\": $NEXT_REV}"

   # Confirm deletion (skill list will no longer contain SKILL_ID)
   curl -s -X GET http://localhost:4002/api/v1/profile/skills \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID"
   ```

5. **Verify Onboarding Completion**:
   ```bash
   LATEST_REV=$(curl -s -X GET http://localhost:4002/api/v1/profile \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID" | jq .data.revision)

   curl -s -X POST http://localhost:4002/api/v1/profile/complete \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d "{\"expectedRevision\": $LATEST_REV}"

   # Subsequent draft save will return 409 onboarding_complete
   COMPLETED_REV=$((LATEST_REV + 1))
   curl -s -X PUT http://localhost:4002/api/v1/profile/draft \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Workspace-Id: $WORKSPACE_ID" \
     -H "Content-Type: application/json" \
     -d "{\"expectedRevision\": $COMPLETED_REV, \"location\": \"New York, NY\"}"
   ```
