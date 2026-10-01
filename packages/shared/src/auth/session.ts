import { z } from "zod";

const identitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(200).nullable(),
  workspaceId: z.string().uuid(),
  isOnboarded: z.boolean(),
});
const tokenSchema = z.object({
  data: z.object({
    accessToken: z.string().regex(/^[a-f0-9]{64}$/),
    expiresIn: z.number().positive().max(300),
  }),
});
export type SessionIdentity = z.infer<typeof identitySchema>;
export type SessionState =
  | {
      status: "loading" | "anonymous" | "error";
      identity?: never;
      operation?: "logout";
    }
  | { status: "authenticated"; identity: SessionIdentity };
export interface SessionTransport {
  request: typeof fetch;
  exclusive: <T>(operation: () => Promise<T>) => Promise<T>;
  notifyLogout: () => void;
}
export const AUTH_URL = "http://localhost:4001/api/v1/auth";

/** Tokens remain inside this controller and never enter storage or federation props. */
export function createSessionController(transport: SessionTransport) {
  let state: SessionState = { status: "loading" };
  let token: string | undefined;
  let generation = 0;
  let request: Promise<void> | undefined;
  let logoutBlocked = false;
  const listeners = new Set<() => void>();
  const publish = (value: SessionState) => {
    state = value;
    for (const listener of listeners) listener();
  };
  const clear = () => {
    generation++;
    token = undefined;
    publish({ status: "anonymous" });
  };
  const call = (path: string, options: RequestInit = {}) =>
    transport.request(`${AUTH_URL}/${path}`, {
      ...options,
      credentials: "include",
      signal: AbortSignal.timeout(10000),
    });
  function restore(): Promise<void> {
    if (logoutBlocked) return Promise.resolve();
    if (request) return request;
    const version = generation;
    request = transport
      .exclusive(async () => {
        if (version !== generation) return;
        try {
          let me = token
            ? await call("me", {
                headers: { Authorization: `Bearer ${token}` },
              })
            : undefined;
          if (version !== generation) return;
          if (!me || me.status === 401) {
            token = undefined;
            const refresh = await call("refresh", { method: "POST" });
            if (version !== generation) return;
            if (refresh.status === 401) {
              clear();
              return;
            }
            if (!refresh.ok) throw new Error("Session unavailable");
            const body = tokenSchema.parse(await refresh.json());
            if (version !== generation) return;
            token = body.data.accessToken;
            me = await call("me", {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
          if (version !== generation) return;
          if (me.status === 401) {
            clear();
            return;
          }
          if (!me.ok) throw new Error("Session unavailable");
          const body = z
            .object({ data: identitySchema })
            .parse(await me.json());
          if (version === generation)
            publish({ status: "authenticated", identity: body.data });
        } catch {
          if (version === generation) {
            token = undefined;
            publish({ status: "error" });
          }
        }
      })
      .catch(() => {
        if (version === generation) {
          token = undefined;
          publish({ status: "error" });
        }
      })
      .finally(() => {
        request = undefined;
      });
    return request;
  }
  async function logout() {
    logoutBlocked = true;
    clear();
    transport.notifyLogout();
    try {
      await transport.exclusive(async () => {
        const response = await call("logout", { method: "POST" });
        if (!response.ok)
          throw new Error(
            "Sign-out failed. Retry to revoke the server session.",
          );
      });
      logoutBlocked = false;
      clear();
      transport.notifyLogout();
    } catch {
      publish({ status: "error", operation: "logout" });
      throw new Error("Sign-out failed. Retry to revoke the server session.");
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    restore,
    logout,
    receiveLogout() {
      logoutBlocked = true;
      clear();
    },
  };
}
