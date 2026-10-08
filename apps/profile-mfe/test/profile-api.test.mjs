import test from "node:test";
import assert from "node:assert/strict";
import {
  createProfileClient,
  ProfileApiError,
  profileFields,
  validateFields,
} from "../src/profile-api.ts";
const workspace = "22222222-2222-4222-8222-222222222222";
const dto = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Synthetic Person",
  location: "Example City",
  professionalSummary: "Supported facts.",
  revision: 2,
};
const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status });
test("load distinguishes a missing profile from unavailable or denied access", async () => {
  const calls = [];
  const queue = [
    reply({ error: { code: "not_found" } }, 404),
    reply({ error: { code: "forbidden" } }, 403),
    reply({ error: { code: "profile_unavailable" } }, 503),
  ];
  const client = createProfileClient(async (path, options) => {
    calls.push({ path, options });
    return queue.shift();
  }, workspace);
  assert.equal(await client.load(), null);
  await assert.rejects(
    client.load(),
    (e) => e instanceof ProfileApiError && e.code === "forbidden",
  );
  await assert.rejects(client.load(), (e) => e.code === "profile_unavailable");
  assert.equal(calls[0].path, "/api/v1/profile");
  assert.equal(calls[0].options.headers.get("X-Workspace-Id"), workspace);
});
test("rejects malformed DTOs and extra contact fields", async () => {
  for (const data of [
    { ...dto, email: "private@example.invalid" },
    { ...dto, revision: 0 },
    { ...dto, id: "forged" },
    { ...dto, location: 4 },
    { ...dto, professionalSummary: undefined },
  ]) {
    const client = createProfileClient(async () => reply({ data }), workspace);
    await assert.rejects(client.load(), (e) => e.code === "unavailable");
  }
});
test("explicit creation trims facts and converts empty optional fields to null", async () => {
  let body;
  const client = createProfileClient(async (path, options) => {
    assert.equal(path, "/api/v1/profile");
    assert.equal(options.method, "POST");
    body = JSON.parse(options.body);
    return reply({ data: dto }, 201);
  }, workspace);
  await client.save(
    { fullName: " Synthetic Person ", location: " ", professionalSummary: "" },
    null,
    true,
  );
  assert.deepEqual(body, {
    fullName: "Synthetic Person",
    location: null,
    professionalSummary: null,
  });
});
test("incomplete draft patches only changed fields with the observed revision", async () => {
  let body;
  const client = createProfileClient(async (path, options) => {
    assert.equal(path, "/api/v1/profile/draft");
    body = JSON.parse(options.body);
    return reply({ data: { ...dto, location: null, revision: 3 } });
  }, workspace);
  const saved = await client.save(
    { ...profileFields(dto), location: "" },
    dto,
    true,
  );
  assert.deepEqual(body, { location: null, expectedRevision: 2 });
  assert.equal(saved.revision, 3);
});
test("completed profile uses full update and does not reopen onboarding", async () => {
  let body;
  const client = createProfileClient(async (path, options) => {
    assert.equal(path, "/api/v1/profile");
    assert.equal(options.method, "PUT");
    body = JSON.parse(options.body);
    return reply({ data: dto });
  }, workspace);
  await client.save(
    { ...profileFields(dto), professionalSummary: "Revised supported facts." },
    dto,
    false,
  );
  assert.deepEqual(body, {
    fullName: dto.fullName,
    location: dto.location,
    professionalSummary: "Revised supported facts.",
    expectedRevision: 2,
  });
});
test("does not retry conflicts or uncertain saves; leaves caller input intact", async () => {
  for (const code of [
    "revision_conflict",
    "profile_exists",
    "onboarding_complete",
    "profile_unavailable",
  ]) {
    let calls = 0;
    const fields = { ...profileFields(dto), location: "New City" };
    const client = createProfileClient(async () => {
      calls++;
      return reply(
        { error: { code } },
        code === "profile_unavailable" ? 503 : 409,
      );
    }, workspace);
    await assert.rejects(
      client.save(fields, dto, true),
      (e) => e.code === code,
    );
    assert.equal(calls, 1);
    assert.equal(fields.location, "New City");
  }
});
test("validates name and limits before sending; unchanged drafts create no write", async () => {
  let calls = 0;
  const client = createProfileClient(async () => {
    calls++;
    return reply({ data: dto });
  }, workspace);
  await assert.rejects(
    client.save({ ...profileFields(dto), fullName: " " }, null, true),
    (e) => e.code === "invalid_input",
  );
  assert.equal(await client.save(profileFields(dto), dto, true), dto);
  assert.equal(calls, 0);
  assert.equal(
    Object.keys(
      validateFields({
        fullName: "x".repeat(201),
        location: "x".repeat(201),
        professionalSummary: "x".repeat(5001),
      }),
    ).length,
    3,
  );
  assert.throws(
    () => createProfileClient(fetch, "foreign"),
    (e) => e.code === "forbidden",
  );
});
