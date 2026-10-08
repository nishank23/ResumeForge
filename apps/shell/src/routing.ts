import type { SessionIdentity, SessionState } from "@resume-forge/shared";

export type RouteDecision =
  | { kind: "allow" }
  | { kind: "loading" }
  | { kind: "recover" }
  | { kind: "redirect"; to: "/sign-in" }
  | { kind: "deny" };

/** Browser navigation only; backend use cases must enforce their own policies. */
export function resolveProtectedRoute(
  session: SessionState,
  selectedWorkspaceId?: string,
): RouteDecision {
  if (session.status === "authenticated") {
    if (
      selectedWorkspaceId !== undefined &&
      selectedWorkspaceId !== session.identity.workspaceId
    )
      return { kind: "deny" };
    return { kind: "allow" };
  }
  if (session.status === "loading") return { kind: "loading" };
  if (session.status === "error") return { kind: "recover" };
  return { kind: "redirect", to: "/sign-in" };
}

export function sessionHome(identity: SessionIdentity): string {
  return `/w/${identity.workspaceId}/resumes`;
}

/** Remount drafts/selections on actor or authoritative workspace changes. */
export function sessionRouteKey(session: SessionState): string {
  return session.status === "authenticated"
    ? `${session.identity.id}:${session.identity.workspaceId}`
    : session.status;
}

/** Library chrome gives way to the resume editor and intake workspace. */
export function isResumeWorkspace(pathname: string): boolean {
  return /^\/w\/[^/]+\/resumes\/[^/]+\/?$/.test(pathname);
}
