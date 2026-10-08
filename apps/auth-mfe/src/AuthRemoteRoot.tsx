import React, { useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import {
  AuroraBackdrop,
  Button,
  GlassCardSurface,
  useSession,
  type ShellFederationContext,
} from "@resume-forge/shared";

const AUTH_URL = "http://localhost:4001/api/v1/auth";
export interface AuthRemoteRootProps {
  readonly context?: ShellFederationContext;
}

export function AuthRemoteRoot({ context }: AuthRemoteRootProps) {
  const [loading, setLoading] = useState(false);
  const { state: session, restore, logout } = useSession();
  const signedIn = session.status === "authenticated";
  const logoutFailed =
    session.status === "error" && session.operation === "logout";
  const [error, setError] = useState<string | null>(() => {
    const reason = new URLSearchParams(window.location.search).get(
      "auth_error",
    );
    if (reason === "cancelled")
      return "Google sign-in was cancelled. You can try again.";
    if (reason === "account_link_required")
      return "This email already has an account. Sign in with the original provider; accounts are not linked automatically.";
    if (reason)
      return "Google sign-in could not finish. Try again and check the callback configuration if it continues.";
    return null;
  });
  const handleLoginGoogle = (): void => {
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(`${AUTH_URL}/google/url`, {
          credentials: "include",
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Sign-in unavailable");
        const data: unknown = await response.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("url" in data) ||
          typeof data.url !== "string"
        )
          throw new Error("Invalid response");
        const url = new URL(data.url);
        if (url.origin !== "https://accounts.google.com")
          throw new Error("Invalid provider");
        window.location.assign(url.href);
      } catch {
        setError(
          "Google sign-in is unavailable. Please try again in a moment.",
        );
        setLoading(false);
      }
    })();
  };
  const handleLogout = (): void => {
    setLoading(true);
    void logout()
      .then(() => {
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch(() => {
        setError("Sign-out failed. Please retry to end your server session.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <section
      className="rf-auth"
      data-remote-module="auth_mfe"
      data-react-version={React.version}
    >
      <AuroraBackdrop staticMode reducedMotion={context?.reducedMotion} />
      <div className="rf-auth-content">
        <span className="rf-auth-icon">
          <FileText size={28} />
        </span>
        <h1>
          Your next chapter
          <br />
          starts here.
        </h1>
        <p>
          One place for your experience.
          <br />A focused resume for every opportunity.
        </p>
        <GlassCardSurface glowOnHover={false}>
          <h2>Welcome to resume-forge</h2>
          <p>
            {signedIn
              ? "Google sign-in succeeded. Your local session is active."
              : "Sign in to your account."}
          </p>
          {error ? <p role="alert">{error}</p> : null}
          {session.status === "loading" ? (
            <p role="status">Checking your session…</p>
          ) : null}
          {session.status === "error" && !logoutFailed ? (
            <p role="alert">
              Your session could not be verified. Check the auth service and try
              again.
            </p>
          ) : null}
          {session.status === "error" && !logoutFailed ? (
            <Button
              variant="outline"
              onClick={() => {
                void restore();
              }}
            >
              Retry session check
            </Button>
          ) : null}
          {logoutFailed ? (
            <Button onClick={handleLogout} disabled={loading}>
              Retry sign out
            </Button>
          ) : null}
          {signedIn ? (
            <p>
              Open your resumes to upload a file or start a new document.
            </p>
          ) : null}
          <div className="rf-auth-actions">
            <Button
              onClick={signedIn ? handleLogout : handleLoginGoogle}
              disabled={loading}
              variant="outline"
            >
              {loading
                ? "Please wait…"
                : signedIn
                  ? "Sign out"
                  : "Continue with Google"}
            </Button>
            <Button disabled variant="outline">
              LinkedIn — awaiting credentials
            </Button>
            {signedIn && context?.onNavigate ? (
              <Button
                onClick={() => {
                  context.onNavigate?.(
                    `/w/${session.identity.workspaceId}/resumes`,
                  );
                }}
              >
                Open my resumes
              </Button>
            ) : null}
          </div>
        </GlassCardSurface>
        <span className="rf-auth-foot">
          <ShieldCheck size={16} />
          Your resume data remains private and secure.
        </span>
      </div>
    </section>
  );
}
export default AuthRemoteRoot;
