// Browser checks only: real shared/Performative components, isolated synthetic API transport.
export * from "../../../../packages/shared/dist/index.js";
const state =
  new URLSearchParams(location.search).get("view") === "auth"
    ? { status: "anonymous" }
    : { status: "authenticated", identity: { name: "Morgan Example" } };
const requestApi = (path, options) => window.__resumeUx.request(path, options);
export function useSession() {
  return { state, requestApi };
}
