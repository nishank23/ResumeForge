import { connect } from "node:net";
import { setTimeout } from "node:timers/promises";

/** A service binds its private port only after its restricted role check passes. */
export async function waitForCloudPort(port, signal, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const ready = await new Promise((resolve) => {
      const socket = connect({ host: "127.0.0.1", port });
      let finished = false;
      const finish = (value) => {
        if (finished) return;
        finished = true;
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(500);
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.once("timeout", () => finish(false));
    });
    signal.throwIfAborted();
    if (ready) return;
    await setTimeout(200, undefined, { signal });
  }
  throw new Error("Cloud service did not become ready.");
}
