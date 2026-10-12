import type { ReactNode } from "react";
import { Link, Navigate, Outlet, useParams } from "react-router";
import { Button, StudioLoading, type SessionState } from "@resume-forge/shared";
import { resolveProtectedRoute, sessionHome } from "./routing";

export function SessionRecovery({
  session,
  retry,
}: {
  session: SessionState;
  retry: () => Promise<void>;
}) {
  if (session.status === "loading")
    return <StudioLoading />;
  return (
    <div className="rf-empty">
      <h1>We couldn’t verify your session</h1>
      <p role="alert">
        Check your connection and try again to open your workspace.
      </p>
      {session.status === "error" && session.operation === "logout" ? (
        <Link className="rf-text-link" to="/sign-in">
          Retry sign out
        </Link>
      ) : (
        <Button
          onClick={() => {
            void retry();
          }}
        >
          Retry session check
        </Button>
      )}
      <Link className="rf-text-link" to="/sign-in">
        Go to sign in
      </Link>
    </div>
  );
}

export function ProtectedRoute({
  session,
  retry,
  workspace = false,
}: {
  session: SessionState;
  retry: () => Promise<void>;
  workspace?: boolean;
}) {
  const params = useParams();
  const decision = resolveProtectedRoute(
    session,
    workspace ? (params.workspaceId ?? "") : undefined,
  );
  if (decision.kind === "loading" || decision.kind === "recover")
    return <SessionRecovery session={session} retry={retry} />;
  if (decision.kind === "redirect")
    return <Navigate to={decision.to} replace />;
  if (decision.kind === "deny")
    return (
      <div className="rf-empty" role="alert">
        <h1>This workspace isn’t available</h1>
        <p>
          Open the personal workspace associated with your signed-in account.
        </p>
        <Link className="rf-text-link" to="/">
          Go to my workspace
        </Link>
      </div>
    );
  return <Outlet />;
}

export function HomeRoute({
  session,
  retry,
}: {
  session: SessionState;
  retry: () => Promise<void>;
}) {
  if (session.status === "authenticated")
    return <Navigate to={sessionHome(session.identity)} replace />;
  if (session.status === "anonymous") return <Navigate to="/sign-in" replace />;
  return <SessionRecovery session={session} retry={retry} />;
}

/** A verified identity always owns the destination; callback/return flags are never authority. */
export function SignInRoute({
  session,
  retry,
  children,
}: {
  session: SessionState;
  retry: () => Promise<void>;
  children: ReactNode;
}) {
  if (session.status === "authenticated")
    return <Navigate to={sessionHome(session.identity)} replace />;
  if (session.status === "loading")
    return <SessionRecovery session={session} retry={retry} />;
  return children;
}

export function OnboardingEntry({
  session,
}: {
  session: SessionState;
  children?: ReactNode;
}) {
  return session.status === "authenticated" ? (
    <Navigate to={sessionHome(session.identity)} replace />
  ) : null;
}
