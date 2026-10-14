import React, { useState } from "react";
import { FileText, Moon, ShieldCheck, Sun } from "lucide-react";
import {
  AsciiSpotlight,
  Button,
  GlassCardSurface,
  RequestFeedback,
  useSession,
  AUTH_URL,
  type ShellFederationContext,
} from "@resume-forge/shared";

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
      <AsciiSpotlight
        theme={context?.theme}
        reducedMotion={context?.reducedMotion}
        bright
        fullScreen
      />
      <header className="rf-auth-header">
        <span>Resume workspace</span>
        {context?.onToggleTheme ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={context.onToggleTheme}
            aria-label={
              context.theme === "light"
                ? "Switch to dark theme"
                : "Switch to light theme"
            }
          >
            {context.theme === "light" ? (
              <Moon size={18} aria-hidden="true" />
            ) : (
              <Sun size={18} aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </header>
      <div className="rf-auth-content">
        <div className="rf-auth-story">
          <span className="rf-auth-icon">
            <FileText size={28} aria-hidden="true" />
          </span>
          <h1>Forge Studio</h1>
          <p className="rf-auth-tagline">Your experience, well told.</p>
          <p>
            Collect your work. Refine your story. Make a resume for the
            opportunity in front of you.
          </p>
          <span className="rf-auth-foot">
            <ShieldCheck size={16} aria-hidden="true" />
            Saved to your account. AI edits need your review.
          </span>
        </div>
        <GlassCardSurface glowOnHover={false}>
          <h2>{signedIn ? "Your account" : "Make your next move"}</h2>
          <p>
            {signedIn
              ? "You’re signed in. Your resumes are ready."
              : "Create your resume workspace. Sign in or get started with Google."}
          </p>
          {error ? <p role="alert">{error}</p> : null}
          {session.status === "loading" ? (
            <RequestFeedback
              label="Checking your session"
              reducedMotion={context?.reducedMotion}
            />
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
            <p>Open your resumes to upload a file or start a new document.</p>
          ) : null}
          <div className="rf-auth-actions">
            <Button
              onClick={signedIn ? handleLogout : handleLoginGoogle}
              disabled={loading || session.status === "loading" || logoutFailed}
            >
              {loading
                ? "Please wait…"
                : signedIn
                  ? "Sign out"
                  : "Continue with Google"}
            </Button>
            <Button disabled variant="outline">
              LinkedIn coming soon
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
      </div>
      <footer className="rf-auth-footer">
        <span>Built around your experience.</span>
        <span>Your resumes save to your account</span>
      </footer>
    </section>
  );
}
export default AuthRemoteRoot;
