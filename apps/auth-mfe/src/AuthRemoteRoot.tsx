import React from "react";
import { FileText, ShieldCheck } from "lucide-react";
import {
  AuroraBackdrop,
  Button,
  GlassCardSurface,
  type ShellFederationContext,
} from "@resume-forge/shared";
export interface AuthRemoteRootProps {
  readonly context?: ShellFederationContext;
}
export function AuthRemoteRoot({ context }: AuthRemoteRootProps) {
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
            Sign-in is coming soon. For now, explore the workspace with sample
            content.
          </p>
          <div className="rf-auth-actions">
            <Button disabled variant="outline">
              Continue with Google
            </Button>
            <Button disabled variant="outline">
              Continue with LinkedIn
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
          No account or personal information needed for this preview.
        </span>
      </div>
    </section>
  );
}
export default AuthRemoteRoot;
