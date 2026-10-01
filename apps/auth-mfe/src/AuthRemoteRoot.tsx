import React, { useEffect, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import {
  AuroraBackdrop,
  Button,
  GlassCardSurface,
  type ShellFederationContext,
} from "@resume-forge/shared";

const AUTH_URL = "http://localhost:4001/api/v1/auth";
let sessionRequest: Promise<boolean> | undefined;
function restoreSession(): Promise<boolean> {
  // Share the request across React StrictMode mounts; refresh credentials are single-use.
  sessionRequest ??= (async () => {
    const response = await fetch(`${AUTH_URL}/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (response.status === 401) return false;
    if (!response.ok) throw new Error("Session unavailable");
    const body: unknown = await response.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("data" in body) ||
      !body.data ||
      typeof body.data !== "object" ||
      !("accessToken" in body.data) ||
      typeof body.data.accessToken !== "string"
    )
      throw new Error("Invalid session response");
    const me = await fetch(`${AUTH_URL}/me`, {
      headers: { Authorization: `Bearer ${body.data.accessToken}` },
    });
    return me.ok;
  })().finally(() => {
    sessionRequest = undefined;
  });
  return sessionRequest;
}

export interface AuthRemoteRootProps {
  readonly context?: ShellFederationContext;
}

export function AuthRemoteRoot({ context }: AuthRemoteRootProps) {
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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
  useEffect(() => {
    let mounted = true;
    void restoreSession()
      .then((authenticated) => {
        if (mounted) setSignedIn(authenticated);
      })
      .catch(() => {
        if (
          mounted &&
          new URLSearchParams(window.location.search).has("signed_in")
        ) {
          setError(
            "The session could not be restored. Please try signing in again.",
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

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
          "Google sign-in is unavailable. Check that the auth service is running and restart pnpm dev after changing .env.",
        );
        setLoading(false);
      }
    })();
  };
  const handleLogout = (): void => {
    setLoading(true);
    void fetch(`${AUTH_URL}/logout`, { method: "POST", credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("Logout failed");
        setSignedIn(false);
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch(() => {
        setError("Sign-out failed. Please try again.");
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
          {signedIn ? (
            <p>
              Profile onboarding is still being connected. The workspace preview
              uses sample data.
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
              LinkedIn — coming next
            </Button>
            {context?.onNavigate ? (
              <Button
                onClick={() => {
                  context.onNavigate?.(
                    `/w/${context.activeWorkspace.id}/resumes`,
                  );
                }}
              >
                Explore the preview
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
