import { useEffect, useSyncExternalStore } from "react";
import { createSessionController } from "./session";

let channel: BroadcastChannel | undefined;
let started = 0;
let interval: ReturnType<typeof setInterval> | undefined;
const session = createSessionController({
  request: (...args) => fetch(...args),
  exclusive: async (operation) => {
    // Fail closed instead of racing single-use refresh cookies on older browsers.
    const locks = (navigator as Partial<Navigator>).locks;
    if (!locks) return Promise.reject(new Error("Web Locks required"));
    return locks.request("resume-forge-auth", operation);
  },
  notifyLogout: () => channel?.postMessage("logout"),
});
const refresh = () => {
  void session.restore();
};
function start() {
  if (started++ === 0) {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("resume-forge-session");
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === "logout") session.receiveLogout();
      };
    }
    window.addEventListener("focus", refresh);
    interval = setInterval(refresh, 60000);
    refresh();
  }
  return () => {
    if (--started === 0) {
      window.removeEventListener("focus", refresh);
      clearInterval(interval);
      channel?.close();
      channel = undefined;
    }
  };
}
export function useSession() {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  useEffect(start, []);
  return { state, restore: session.restore, logout: session.logout };
}
