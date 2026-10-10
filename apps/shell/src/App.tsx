import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import {
  ArrowRight,
  Briefcase,
  FileText,
  FolderOpen,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import {
  DocumentStatus,
  Button,
  Select,
  RemoteErrorBoundary,
  RemoteSuspenseFallback,
  useReducedMotion,
  useSession,
  type ShellFederationContext,
  type WorkspaceRef,
} from "@resume-forge/shared";
import {
  HomeRoute,
  OnboardingEntry,
  ProtectedRoute,
  SignInRoute,
} from "./SessionRoutes";
import { isResumeWorkspace, sessionRouteKey } from "./routing";
import { useThemePreference } from "./useThemePreference";
import { isThemePreference } from "./theme-preference";

function createRetryableLazy<P extends object>(
  factory: () => Promise<{ default: React.ComponentType<P> }>,
): React.ComponentType<P> {
  let CurrentLazy: React.LazyExoticComponent<React.ComponentType<P>> | null =
    null;

  const getLazy = () => {
    if (!CurrentLazy) {
      CurrentLazy = lazy(() =>
        factory().catch((error: unknown) => {
          CurrentLazy = null;
          throw error;
        }),
      );
    }
    return CurrentLazy;
  };

  return function RetryableLazyComponent(props: P) {
    const Component = getLazy();
    return <Component {...props} />;
  };
}

const LazyAuthRemoteRoot = createRetryableLazy(
  () => import("auth_mfe/AuthRemoteRoot"),
);
const LazyProfileRemoteRoot = createRetryableLazy(
  () => import("profile_mfe/ProfileRemoteRoot"),
);
const LazyResumeRemoteRoot = createRetryableLazy(
  () => import("resume_mfe/ResumeRemoteRoot"),
);

export function App() {
  return (
    <BrowserRouter>
      <WorkspaceShell />
    </BrowserRouter>
  );
}

function WorkspaceShell() {
  const { state: session, restore, logout } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, preference: themePreference, setPreference, toggleTheme } =
    useThemePreference();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quietMotion, setQuietMotion] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const reducedMotion = useReducedMotion() || quietMotion;
  const workspace: WorkspaceRef = {
    id: session.status === "authenticated" ? session.identity.workspaceId : "",
    name: "Personal workspace",
    type: "individual",
    roleLabel: "Personal",
  };
  const prefix = session.status === "authenticated" ? `/w/${workspace.id}` : "";
  const home =
    session.status === "authenticated" ? `${prefix}/resumes` : "/sign-in";
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMenuOpen(false);
    setSimulateFailure(false);
  }, [location.pathname]);
  const context: ShellFederationContext = {
    activeWorkspace: workspace,
    availableWorkspaces: session.status === "authenticated" ? [workspace] : [],
    theme,
    reducedMotion,
    apiBaseUrl: "http://localhost:4000",
    onToggleTheme: toggleTheme,
    onNavigate: (path) => {
      void navigate(path);
    },
  };
  const items = [
    { label: "My resumes", path: `${prefix}/resumes`, icon: FolderOpen },
    { label: "My profile", path: `${prefix}/profile`, icon: UserRound },
    {
      label: "Job descriptions",
      path: `${prefix}/jd-history`,
      icon: Briefcase,
    },
  ];
  const current = isResumeWorkspace(location.pathname)
    ? "Resume workspace"
    : location.pathname === "/onboarding"
      ? "Profile setup"
      : location.pathname.includes("/profile")
        ? "My profile"
        : location.pathname.includes("jd-history")
          ? "Job descriptions"
          : location.pathname.includes("settings")
            ? "Preferences"
            : location.pathname === "/sign-in"
              ? "Welcome"
              : "My resumes";
  const isResumeEditor = isResumeWorkspace(location.pathname);
  const signedIn = session.status === "authenticated";
  const showWorkspaceChrome = signedIn && !isResumeEditor;
  const handleSignOut = () => {
    setSigningOut(true);
    void logout()
      .then(() => {
        void navigate("/sign-in", { replace: true });
      })
      .catch(() => {
        void navigate("/sign-in", { replace: true });
      })
      .finally(() => {
        setSigningOut(false);
      });
  };
  const remote = (
    name: "auth" | "profile" | "resume",
    child: React.ReactNode,
  ) => (
    <FederatedRemoteSlot
      remoteName={`${name}-mfe`}
      remoteUrl={`http://localhost:${name === "auth" ? "3001" : name === "profile" ? "3002" : "3003"}/remoteEntry.js`}
      simulateFailure={simulateFailure}
      onResetSimulatedFailure={() => {
        setSimulateFailure(false);
      }}
    >
      {child}
    </FederatedRemoteSlot>
  );
  return (
    <div
      className={`rf-workspace ${!signedIn ? "rf-workspace-entry" : ""} ${isResumeEditor ? "rf-workspace-editor" : ""} ${sidebarCollapsed && showWorkspaceChrome ? "rf-workspace-collapsed" : ""}`}
      data-shell-root="resume-forge"
      data-react-version={React.version}
    >
      <a href="#main-content" className="rf-skip">
        Skip to main content
      </a>
      {showWorkspaceChrome ? (
        <aside id="workspace-sidebar" className="rf-sidebar rf-app-chrome">
          <Link
            className="rf-brand"
            to="/"
            aria-label="resume-forge home"
            title={sidebarCollapsed ? "resume-forge home" : undefined}
          >
            <span className="rf-brand-mark">
              <FileText size={21} aria-hidden="true" />
            </span>
            <span className="rf-brand-text">
              Forge <span className="rf-brand-studio">Studio</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            className="rf-sidebar-toggle"
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            aria-controls="workspace-sidebar"
            onClick={() => {
              setSidebarCollapsed((value) => !value);
            }}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={19} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={19} aria-hidden="true" />
            )}
            <span className="rf-sidebar-toggle-label">Collapse sidebar</span>
          </Button>
          <div className="rf-workspace-label" title="Personal workspace">
            <span className="rf-avatar">P</span>
            <div>
              <strong>Personal workspace</strong>
              <span>Make your experience count</span>
            </div>
          </div>
          <button
            className="rf-mobile-menu"
            aria-expanded={menuOpen}
            aria-controls="workspace-nav"
            onClick={() => {
              setMenuOpen(!menuOpen);
            }}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <nav
            id="workspace-nav"
            className={`rf-nav ${menuOpen ? "is-open" : ""}`}
            aria-label="Workspace navigation"
          >
            {items.map((item) => (
              <Link
                key={item.path}
                onClick={() => {
                  setMenuOpen(false);
                }}
                to={item.path}
                aria-label={item.label}
                title={sidebarCollapsed ? item.label : undefined}
                aria-current={
                  location.pathname.startsWith(item.path) ? "page" : undefined
                }
              >
                <item.icon size={19} aria-hidden="true" />
                <span className="rf-nav-label">{item.label}</span>
              </Link>
            ))}
            <Link
              to={`${prefix}/settings`}
              aria-label="Preferences"
              title={sidebarCollapsed ? "Preferences" : undefined}
              aria-current={current === "Preferences" ? "page" : undefined}
            >
              <Settings size={19} aria-hidden="true" />
              <span className="rf-nav-label">Preferences</span>
            </Link>
          </nav>
          <div className="rf-sidebar-bottom">
            <div className="rf-preview-note">
              <DocumentStatus>Personal workspace</DocumentStatus>
              <p>
                Upload your resume, edit your experience, and save your work.
              </p>
            </div>
            <Link
              className="rf-account"
              to={`${prefix}/settings`}
              aria-label="Account preferences"
              title={sidebarCollapsed ? "Account preferences" : undefined}
            >
              <span className="rf-avatar">
                {(session.identity.name ?? "Account").charAt(0)}
              </span>
              <span>
                {session.identity.name ?? "Signed in"}
                <small>Signed in · Personal workspace</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      ) : null}
      <div className="rf-workspace-body">
        {showWorkspaceChrome ? (
          <header className="rf-topbar rf-app-chrome">
            <span>
              Workspace <span className="rf-breadcrumb-slash">/</span>{" "}
              <strong>{current}</strong>
            </span>
            <div>
              <DocumentStatus tone="saved">Personal workspace</DocumentStatus>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                aria-label={
                  theme === "light"
                    ? "Switch to dark theme"
                    : "Switch to light theme"
                }
              >
                {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
              </Button>
            </div>
          </header>
        ) : null}
        <main id="main-content" tabIndex={-1} className="rf-main">
          <div className="rf-route-view" key={location.pathname}>
            <Routes key={sessionRouteKey(session)}>
              <Route
                path="/"
                element={<HomeRoute session={session} retry={restore} />}
              />
              <Route
                path="/sign-in"
                element={
                  <SignInRoute session={session} retry={restore}>
                    {remote("auth", <LazyAuthRemoteRoot context={context} />)}
                  </SignInRoute>
                }
              />
              <Route
                element={<ProtectedRoute session={session} retry={restore} />}
              >
                <Route
                  path="/onboarding"
                  element={
                    <OnboardingEntry session={session}>
                      {remote(
                        "profile",
                        <LazyProfileRemoteRoot context={context} />,
                      )}
                    </OnboardingEntry>
                  }
                />
              </Route>
              <Route
                path="/w/:workspaceId"
                element={
                  <ProtectedRoute session={session} retry={restore} workspace />
                }
              >
                <Route
                  index
                  element={<Navigate to={`${prefix}/resumes`} replace />}
                />
                <Route
                  path="profile"
                  element={remote(
                    "profile",
                    <LazyProfileRemoteRoot context={context} />,
                  )}
                />
                <Route
                  path="resumes"
                  element={remote(
                    "resume",
                    <LazyResumeRemoteRoot
                      key="library"
                      context={context}
                      view="library"
                    />,
                  )}
                />
                <Route
                  path="resumes/new"
                  element={remote(
                    "resume",
                    <LazyResumeRemoteRoot
                      key="create"
                      context={context}
                      view="create"
                    />,
                  )}
                />
                <Route
                  path="resumes/upload"
                  element={remote(
                    "resume",
                    <LazyResumeRemoteRoot
                      key="upload"
                      context={context}
                      view="upload"
                    />,
                  )}
                />
                <Route
                  path="resumes/:resumeId"
                  element={remote(
                    "resume",
                    <LazyResumeRemoteRoot
                      key={location.pathname}
                      context={context}
                      view="editor"
                      resumeId={location.pathname.split("/").at(-1)}
                    />,
                  )}
                />
                <Route
                  path="jd-history"
                  element={
                    <div className="rf-page">
                      <div className="rf-page-heading">
                        <h1>Job descriptions</h1>
                        <p>The context behind your tailored resumes.</p>
                      </div>
                      <div className="rf-empty">
                        <Briefcase size={32} />
                        <h2>Job descriptions stay with your resumes</h2>
                        <p>
                          Analyze a job description inside a saved resume using
                          Tailor to job. Your latest comparison stays with that
                          resume.
                        </p>
                        <Link className="rf-text-link" to={`${prefix}/resumes`}>
                          Choose a resume <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <div className="rf-page rf-narrow">
                      <div className="rf-page-heading">
                        <h1>Preferences</h1>
                        <p>A workspace that feels comfortable to use.</p>
                      </div>
                      <section className="rf-settings">
                        <h2>Appearance</h2>
                        <div className="rf-setting-row">
                          <div>
                            <strong>Color theme</strong>
                            <p>Resume pages always stay white.</p>
                          </div>
                          <Select
                            aria-label="Color theme"
                            value={themePreference}
                            style={{ width: "auto", minWidth: 150 }}
                            options={[
                              { value: "system", label: "Use device theme" },
                              { value: "light", label: "Light" },
                              { value: "dark", label: "Dark" },
                            ]}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (isThemePreference(value)) setPreference(value);
                            }}
                          />
                        </div>
                        <div className="rf-setting-row">
                          <div>
                            <strong>Reduce motion</strong>
                            <p>Your system preference is always respected.</p>
                          </div>
                          <Button
                            variant="outline"
                            aria-pressed={quietMotion}
                            onClick={() => {
                              setQuietMotion(!quietMotion);
                            }}
                          >
                            {reducedMotion ? "Reduced" : "Standard"}
                          </Button>
                        </div>
                      </section>
                      <section className="rf-settings">
                        <h2>Account</h2>
                        <div className="rf-setting-row">
                          <div>
                            <strong>
                              {session.status === "authenticated"
                                ? (session.identity.name ?? "Signed in")
                                : "Your account"}
                            </strong>
                            <p>Sign out of your personal workspace.</p>
                          </div>
                          <Button
                            variant="outline"
                            loading={signingOut}
                            loadingText="Signing out…"
                            onClick={handleSignOut}
                          >
                            <LogOut size={16} aria-hidden="true" /> Sign out
                          </Button>
                        </div>
                      </section>
                      <details className="rf-diagnostics">
                        <summary>Developer diagnostics</summary>
                        <p>
                          Test the next preview module without affecting saved
                          data.
                        </p>
                        <Button
                          variant="outline"
                          aria-pressed={simulateFailure}
                          onClick={() => {
                            setSimulateFailure(!simulateFailure);
                          }}
                        >
                          {simulateFailure
                            ? "Restore module"
                            : "Simulate remote failure"}
                        </Button>
                        {remote(
                          "auth",
                          <LazyAuthRemoteRoot context={context} />,
                        )}
                      </details>
                    </div>
                  }
                />
                <Route
                  path="*"
                  element={
                    <div className="rf-empty">
                      <h1>Page not found</h1>
                      <Link className="rf-text-link" to={home}>
                        Back to my workspace
                      </Link>
                    </div>
                  }
                />
              </Route>
              <Route
                path="*"
                element={
                  <div className="rf-empty">
                    <h1>Page not found</h1>
                    <p>This page may have moved.</p>
                    <Link className="rf-text-link" to={home}>
                      {session.status === "authenticated"
                        ? "Back to my resumes"
                        : "Go to sign in"}
                    </Link>
                  </div>
                }
              />
            </Routes>
          </div>
        </main>
        {signedIn ? (
          <footer className="rf-footer rf-app-chrome">
            <span>Built around your experience.</span>
            <span>Your resumes save to your account</span>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

interface FederatedRemoteSlotProps {
  readonly remoteName: string;
  readonly remoteUrl: string;
  readonly simulateFailure: boolean;
  readonly onResetSimulatedFailure: () => void;
  readonly children: React.ReactNode;
}

function CrashingRemoteSimulator({
  remoteName,
}: {
  readonly remoteName: string;
}): React.ReactNode {
  throw new Error(
    `Synthetic federation error: ${remoteName} bundle failed to respond or threw during render.`,
  );
}

function FederatedRemoteSlot({
  remoteName,
  remoteUrl,
  simulateFailure,
  onResetSimulatedFailure,
  children,
}: FederatedRemoteSlotProps) {
  return (
    <RemoteErrorBoundary
      key={simulateFailure ? "failing" : "healthy"}
      remoteName={remoteName}
      remoteUrl={remoteUrl}
      onRetry={onResetSimulatedFailure}
    >
      <Suspense fallback={<RemoteSuspenseFallback remoteName={remoteName} />}>
        {simulateFailure ? (
          <CrashingRemoteSimulator remoteName={remoteName} />
        ) : (
          children
        )}
      </Suspense>
    </RemoteErrorBoundary>
  );
}
