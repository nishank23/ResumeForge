import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "./primitives";

export interface RemoteFallbackProps {
  readonly remoteName: string;
  readonly remoteUrl?: string;
  readonly errorMessage?: string;
  readonly onRetry?: () => void;
}

export function RemoteLoadFallback({
  remoteName,
  remoteUrl,
  errorMessage,
  onRetry,
}: RemoteFallbackProps) {
  const label = remoteName.startsWith("auth")
    ? "Sign-in"
    : remoteName.startsWith("profile")
      ? "Profile"
      : "Resume editor";
  return (
    <Card role="alert">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle
            className="h-4 w-4 text-[var(--warning)]"
            aria-hidden="true"
          />
          {label} couldn't load
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-[var(--muted-foreground)]">
        <p>Your workspace is still available. Try loading this page again.</p>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </Button>
        ) : null}
        <details className="text-xs">
          <summary>Technical details</summary>
          <p className="mt-3">
            Make sure all local servers are running with <code>pnpm dev</code>.
          </p>
          <p className="mt-2 break-words">{remoteUrl}</p>
          <p className="mt-2 break-words">{errorMessage}</p>
        </details>
      </CardContent>
    </Card>
  );
}

export function RemoteSuspenseFallback({
  remoteName,
}: {
  readonly remoteName: string;
}) {
  const label = remoteName.startsWith("auth")
    ? "sign-in"
    : remoteName.startsWith("profile")
      ? "profile"
      : "resume editor";
  return (
    <Card aria-busy="true" aria-label={`Loading ${label}`}>
      <CardHeader>
        <span className="text-sm text-[var(--muted-foreground)]">
          Loading {label}…
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

export interface RemoteErrorBoundaryProps {
  readonly remoteName: string;
  readonly remoteUrl?: string;
  readonly onRetry?: () => void;
  readonly children: ReactNode;
}

interface RemoteErrorBoundaryState {
  readonly hasError: boolean;
  readonly errorMessage?: string;
  readonly retryKey: number;
}

export class RemoteErrorBoundary extends Component<
  RemoteErrorBoundaryProps,
  RemoteErrorBoundaryState
> {
  public override state: RemoteErrorBoundaryState = {
    hasError: false,
    retryKey: 0,
  };

  public static getDerivedStateFromError(
    error: unknown,
  ): Partial<RemoteErrorBoundaryState> {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load federated module";
    return {
      hasError: true,
      errorMessage: message,
    };
  }

  public override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error is contained within the remote boundary so the shell remains healthy.
  }

  private readonly handleRetry = () => {
    this.props.onRetry?.();
    this.setState((prev) => ({
      hasError: false,
      errorMessage: undefined,
      retryKey: prev.retryKey + 1,
    }));
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <RemoteLoadFallback
          remoteName={this.props.remoteName}
          remoteUrl={this.props.remoteUrl}
          errorMessage={this.state.errorMessage}
          onRetry={this.handleRetry}
        />
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
