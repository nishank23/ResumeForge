import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { waitForCloudPort } from "../cloud-start.mjs";

test("cloud startup waits for a private service to bind", async () => {
  const server = createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const waiting = waitForCloudPort(port, new AbortController().signal, 2000);
  setTimeout(() => server.listen(port, "127.0.0.1"), 50);
  try {
    await waiting;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("cloud startup stops waiting when its child fails or shutdown begins", async () => {
  const startup = new AbortController();
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const waiting = waitForCloudPort(port, startup.signal);
  setTimeout(() => startup.abort(), 25);
  await assert.rejects(waiting, {
    name: "AbortError",
  });
});

test("cloud startup fails if a service never binds within its startup budget", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  await assert.rejects(
    waitForCloudPort(port, new AbortController().signal, 20),
    {
      message: "Cloud service did not become ready.",
    },
  );
});
