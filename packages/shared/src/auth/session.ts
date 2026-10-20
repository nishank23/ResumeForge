import { z } from "zod";
// Replaced by Vite; native tests and local builds retain the established URLs.
declare const __FORGE_CLOUD__: boolean;
const cloud = typeof __FORGE_CLOUD__ !== "undefined" && __FORGE_CLOUD__;
export const AUTH_URL = cloud
  ? "/api/v1/auth"
  : "http://localhost:4001/api/v1/auth";
const API_URL = cloud ? "" : "http://localhost:4000";
export const SHELL_URL = cloud ? "/" : "http://localhost:3000/";

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

/** Tokens remain inside this controller and never enter storage or federation props. */
export function createSessionController(transport: SessionTransport) {
  let state: SessionState = { status: "loading" };
  let token: string | undefined;
  let generation = 0;
  let request: Promise<void> | undefined;
  let refreshingGrant = false;
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
  function restore(forceRefresh = false): Promise<void> {
    if (logoutBlocked) return Promise.resolve();
    if (request)
      return forceRefresh && !refreshingGrant
        ? request.then(() => restore(true))
        : request;
    const version = generation;
    refreshingGrant = forceRefresh;
    request = transport
      .exclusive(async () => {
        if (version !== generation) return;
        try {
          let me =
            token && !forceRefresh
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
        refreshingGrant = false;
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
  async function requestApi(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    if (
      !/^\/api\/v1\/[a-z][a-z0-9/-]*$/.test(path) &&
      !/^\/api\/v1\/resume\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/pdf\?version=[1-9][0-9]{0,8}$/i.test(
        path,
      ) &&
      !/^\/api\/v1\/resume\?cursor=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        path,
      )
    )
      throw new Error("Invalid API path");
    const version = generation;
    if (state.status !== "authenticated" || !token)
      throw new Error("Session unavailable");
    const actor = state.identity.id;
    const workspace = state.identity.workspaceId;
    const active = () =>
      version === generation &&
      state.status === "authenticated" &&
      state.identity.id === actor &&
      state.identity.workspaceId === workspace &&
      Boolean(token);
    // Queued tailoring must start with a fresh grant, not the last seconds of
    // an existing token. The worker still enforces its original expiry.
    if (
      options.method?.toUpperCase() === "POST" &&
      /^\/api\/v1\/resume\/[a-f0-9-]{36}\/tailoring$/i.test(path)
    ) {
      await restore(true);
      if (!active()) throw new Error("Session unavailable");
    }
    const timeout = path.includes("/pdf?version=") ? 30_000 : 10_000;
    const send = () => {
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${token ?? ""}`);
      return transport.request(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: "omit",
        cache: "no-store",
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(timeout)])
          : AbortSignal.timeout(timeout),
      });
    };
    let response = await send();
    if (!active()) throw new Error("Session changed");
    // A rejected actor cannot have performed a write. Refresh once; never retry outages.
    if (response.status === 401) {
      await restore();
      if (!active()) throw new Error("Session unavailable");
      response = await send();
      if (!active()) throw new Error("Session changed");
      if (response.status === 401) clear();
    }
    return response;
  }
  return {
    requestApi,
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
