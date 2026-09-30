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
  FilePlus2,
  FileText,
  FolderOpen,
  Menu,
  Moon,
  Settings,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import {
  AuroraBackdrop,
  Badge,
  Button,
  RemoteErrorBoundary,
  RemoteSuspenseFallback,
  useReducedMotion,
  type ShellFederationContext,
  type ThemeMode,
  type WorkspaceRef,
} from "@resume-forge/shared";

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

const WORKSPACE: WorkspaceRef = {
  id: "ws-personal-01",
  name: "Personal workspace",
  type: "individual",
  roleLabel: "Preview",
};

export function App() {
  return (
    <BrowserRouter>
      <WorkspaceShell />
    </BrowserRouter>
  );
}

function WorkspaceShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [quietMotion, setQuietMotion] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const reducedMotion = useReducedMotion() || quietMotion;
  const prefix = `/w/${WORKSPACE.id}`;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMenuOpen(false);
    setSimulateFailure(false);
  }, [location.pathname]);
  const toggleTheme = () => {
    setTheme((value) => (value === "light" ? "dark" : "light"));
  };
  const context: ShellFederationContext = {
    activeWorkspace: WORKSPACE,
    availableWorkspaces: [WORKSPACE],
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
  const current = location.pathname.includes("/profile")
    ? "My profile"
    : location.pathname.includes("jd-history")
      ? "Job descriptions"
      : location.pathname.includes("settings")
        ? "Preferences"
        : location.pathname === "/sign-in"
          ? "Welcome"
          : "My resumes";
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
      className="rf-workspace"
      data-shell-root="resume-forge"
      data-react-version={React.version}
    >
      <a href="#main-content" className="rf-skip">
        Skip to main content
      </a>
      <aside className="rf-sidebar rf-app-chrome">
        <Link className="rf-brand" to={`${prefix}/resumes`}>
          <span className="rf-brand-mark">
            <FileText size={21} aria-hidden="true" />
          </span>
          resume-forge<span className="rf-brand-dot">.</span>
        </Link>
        <div className="rf-workspace-label">
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
              aria-current={
                location.pathname.startsWith(item.path) ? "page" : undefined
              }
            >
              <item.icon size={19} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          <Link
            to={`${prefix}/settings`}
            aria-current={current === "Preferences" ? "page" : undefined}
          >
            <Settings size={19} aria-hidden="true" />
            Preferences
          </Link>
        </nav>
        <div className="rf-sidebar-bottom">
          <div className="rf-preview-note">
            <span className="rf-status-dot" />
            Design preview
            <p>Explore with sample content. Changes stay in this session.</p>
          </div>
          <Link className="rf-account" to="/sign-in">
            <span className="rf-avatar">G</span>
            <span>
              Guest preview<small>Account setup coming soon</small>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <div className="rf-workspace-body">
        <header className="rf-topbar rf-app-chrome">
          <span>
            Workspace <span className="rf-breadcrumb-slash">/</span>{" "}
            <strong>{current}</strong>
          </span>
          <div>
            <Badge variant="outline">Preview</Badge>
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
        <main id="main-content" tabIndex={-1} className="rf-main">
          <Routes>
            <Route
              path="/"
              element={<Navigate to={`${prefix}/resumes`} replace />}
            />
            <Route
              path="/sign-in"
              element={remote("auth", <LazyAuthRemoteRoot context={context} />)}
            />
            <Route
              path="/onboarding"
              element={remote(
                "profile",
                <LazyProfileRemoteRoot context={context} />,
              )}
            />
            <Route
              path="/w/:workspaceId/profile"
              element={remote(
                "profile",
                <LazyProfileRemoteRoot context={context} />,
              )}
            />
            <Route
              path="/w/:workspaceId/resumes"
              element={
                <ResumeLibrary prefix={prefix} reducedMotion={reducedMotion} />
              }
            />
            <Route
              path="/w/:workspaceId/resumes/new"
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
              path="/w/:workspaceId/resumes/:resumeId"
              element={remote(
                "resume",
                <LazyResumeRemoteRoot
                  key="editor"
                  context={context}
                  view="editor"
                />,
              )}
            />
            <Route
              path="/w/:workspaceId/jd-history"
              element={
                <div className="rf-page">
                  <div className="rf-page-heading">
                    <h1>Job descriptions</h1>
                    <p>The context behind your tailored resumes.</p>
                  </div>
                  <div className="rf-empty">
                    <Briefcase size={32} />
                    <h2>No job descriptions yet</h2>
                    <p>
                      Saved job descriptions and comparisons will appear here
                      once tailoring is available.
                    </p>
                    <Link className="rf-text-link" to={`${prefix}/resumes/new`}>
                      Explore resume creation <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              }
            />
            <Route
              path="/w/:workspaceId/settings"
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
                      <Button variant="outline" onClick={toggleTheme}>
                        {theme === "light"
                          ? "Use dark theme"
                          : "Use light theme"}
                      </Button>
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
                  <details className="rf-diagnostics">
                    <summary>Developer diagnostics</summary>
                    <p>
                      Test the next preview module without affecting saved data.
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
                    {remote("auth", <LazyAuthRemoteRoot context={context} />)}
                  </details>
                </div>
              }
            />
            <Route
              path="*"
              element={
                <div className="rf-empty">
                  <h1>Page not found</h1>
                  <p>This page may have moved.</p>
                  <Link className="rf-text-link" to={`${prefix}/resumes`}>
                    Back to my resumes
                  </Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="rf-footer rf-app-chrome">
          <span>Built around your experience.</span>
          <span>Sample workspace · Nothing is saved to a server</span>
        </footer>
      </div>
    </div>
  );
}

function ResumeLibrary({
  prefix,
  reducedMotion,
}: {
  readonly prefix: string;
  readonly reducedMotion: boolean;
}) {
  return (
    <div className="rf-page">
      <div className="rf-page-heading rf-heading-row">
        <div>
          <h1>My resumes</h1>
          <p>Your experience, ready for its next chapter.</p>
        </div>
        <Link className="rf-primary-link" to={`${prefix}/resumes/new`}>
          <FilePlus2 size={17} aria-hidden="true" />
          New resume
        </Link>
      </div>
      <section className="rf-welcome">
        <AuroraBackdrop staticMode reducedMotion={reducedMotion} />
        <div className="rf-welcome-copy">
          <h2>
            A strong resume starts
            <br />
            with your story.
          </h2>
          <p>
            Keep your experience in one place. Shape it into a focused resume
            for every opportunity.
          </p>
          <Link className="rf-text-link" to={`${prefix}/profile`}>
            Review your profile <ArrowRight size={17} />
          </Link>
        </div>
        <div className="rf-paper-stack" aria-hidden="true">
          <div className="rf-mini-paper">
            <div className="rf-mini-name">Your name</div>
            <div className="rf-mini-role">Your next chapter</div>
            <hr />
            <strong>Experience</strong>
            <i />
            <i />
            <i />
            <strong>Education</strong>
            <i />
            <i />
            <strong>Skills</strong>
            <i />
          </div>
        </div>
      </section>
      <div className="rf-section-heading">
        <h2>Your workspace</h2>
        <span>1 sample resume</span>
      </div>
      <div className="rf-library-grid">
        <Link className="rf-resume-card" to={`${prefix}/resumes/res-draft-01`}>
          <div className="rf-card-preview" aria-hidden="true">
            <div className="rf-mini-paper">
              <div className="rf-mini-name">Alex Rivera</div>
              <div className="rf-mini-role">Backend engineer</div>
              <hr />
              <strong>Professional summary</strong>
              <i />
              <i />
              <strong>Experience</strong>
              <i />
              <i />
              <i />
              <strong>Skills</strong>
              <i />
            </div>
            <span className="rf-preview-tag">Sample</span>
          </div>
          <div className="rf-resume-card-info">
            <div>
              <h3>Backend engineer</h3>
              <p>Single-column layout · Sample content</p>
            </div>
            <ArrowRight size={18} aria-hidden="true" />
          </div>
        </Link>
        <Link className="rf-new-card" to={`${prefix}/resumes/new`}>
          <span className="rf-add-icon">
            <FilePlus2 size={24} aria-hidden="true" />
          </span>
          <h3>Start a new resume</h3>
          <p>
            Explore a draft from your profile,
            <br />a blank page, or a job description.
          </p>
          <span className="rf-text-link">
            Choose a starting point <ArrowRight size={16} />
          </span>
        </Link>
      </div>
      <div className="rf-library-footnote">
        <FileText size={16} aria-hidden="true" />
        <p>
          This is a design preview. Open the sample to try section selection and
          review a sample rewrite.
        </p>
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
