declare module "auth_mfe/AuthRemoteRoot" {
  import type { ComponentType } from "react";
  import type { ShellFederationContext } from "@resume-forge/shared";

  export interface RemoteRootProps {
    readonly context?: ShellFederationContext;
  }

  export const AuthRemoteRoot: ComponentType<RemoteRootProps>;
  const defaultExport: ComponentType<RemoteRootProps>;
  export default defaultExport;
}

declare module "profile_mfe/ProfileRemoteRoot" {
  import type { ComponentType } from "react";
  import type { ShellFederationContext } from "@resume-forge/shared";

  export interface RemoteRootProps {
    readonly context?: ShellFederationContext;
  }

  export const ProfileRemoteRoot: ComponentType<RemoteRootProps>;
  const defaultExport: ComponentType<RemoteRootProps>;
  export default defaultExport;
}

declare module "resume_mfe/ResumeRemoteRoot" {
  import type { ComponentType } from "react";
  import type { ShellFederationContext } from "@resume-forge/shared";

  export interface RemoteRootProps {
    readonly context?: ShellFederationContext;
    readonly view?: "library" | "create" | "editor" | "upload";
    readonly resumeId?: string;
  }

  export const ResumeRemoteRoot: ComponentType<RemoteRootProps>;
  const defaultExport: ComponentType<RemoteRootProps>;
  export default defaultExport;
}
