# Forge Studio

Forge Studio is a resume and professional-profile workspace. Sign in with Google, upload or create a resume, edit sections, save versions and download the latest saved PDF.

Key features:

- Resume library with search, sorting, rename, confirmed deletion and undo.
- Editable import review for text-based PDF, DOCX, TXT and Markdown.
- Rich-text section editing, local undo/redo, three templates and saved appearance.
- General readiness and job-description matching with actionable feedback.
- Optional paid Gemini analysis and selected-description rewriting, reviewed before Apply.
- JD-based tailoring with guided experience questions, confirmed facts, per-change review and an independent saved copy with recalculated checks and PDF.
- Device-aware light/dark themes and an optional master professional profile.

## Tech stack

- pnpm workspaces, Turborepo and TypeScript.
- React 19, Vite 6, Module Federation and React Router 7.
- Tailwind CSS 4, shared shadcn-style controls, Performative UI, Lucide, React Hook Form and Tiptap.
- Hono on Node.js; Zod; Google OAuth through Arctic.
- PostgreSQL 18, pgvector and Prisma 7.
- PDF.js/Mammoth imports; React PDF exports; server-side Gemini REST adapters.
- Docker Compose for the complete local app.

## Prerequisites

Recommended Docker setup:

- Git.
- Docker Desktop with Docker Compose 2.24.4 or newer on Windows/macOS; Docker Engine and the Compose plugin on Linux.
- On Windows, use supported Windows 10/11 with WSL2 and Linux containers. Enable hardware virtualization.
- A Google OAuth Web application client for sign-in.
- Optional: a billed Gemini project for AI.
- Free host ports 3000–3003, 4000 and 4001. Stop a native app stack using these ports before starting Docker.

Docker includes Node, pnpm, PostgreSQL and pgvector. You do not need to install them separately.

For native development instead, install Node.js 22.12+ within 22.x or Node.js 24+, pnpm 12.6.0, and PostgreSQL 18 with matching pgvector. Put `initdb`, `pg_ctl`, `psql` and `createdb` on PATH. Native services also use ports 4002, 4003 and 55432; optional audit delivery uses 4005.

## Setup and installation

### 1. Install Docker

On Windows:

1. In Administrator PowerShell, run `wsl --install` if WSL is not installed. Restart when prompted.
2. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
3. Start Docker Desktop, enable its WSL2 engine and use Linux containers.
4. In a new terminal, check:

```powershell
docker version
docker compose version
```

`docker version` must show both Client and Server. Docker Desktop must remain running.

On macOS, install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/). On Linux, install [Docker Engine](https://docs.docker.com/engine/install/) and the [Compose plugin](https://docs.docker.com/compose/install/linux/). Verify with the same commands.

### 2. Clone and configure

```sh
git clone https://github.com/resuming-v2/ResumeForge.git
cd ResumeForge
```

Create the root `.env` from the supplied example. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```sh
cp .env.example .env
```

Edit `.env`. Uncomment and set both Google values:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Register this exact authorized redirect URI in the Google OAuth Web application:

```text
http://localhost:4001/api/v1/auth/google/callback
```

If the consent screen is in testing mode, add your Google account as a test user. Use `http://localhost:3000` for the app.

For optional AI, uncomment and set:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_DATA_MODE=paid
```

Set `paid` only for a billed project. The backend uses `gemini-3.8-flash` for full JD tailoring and fact review, `gemini-3.5-flash-lite` for small edits/analysis, and `gemini-embedding-001` with 768 dimensions. Without Gemini, manual editing, local scores and PDFs still work.

These four provider variables are all Docker needs. Do not set `DATABASE_URL`, runtime passwords or internal service keys. Compose generates those in private named volumes. Keep `.env` private; never prefix secrets with `VITE_`. The image excludes `.env`, native `.local/` and private resume files.

### 3. Build and start the full app

Run from the repository root. These commands work in PowerShell, CMD, macOS and Linux terminals:

```sh
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

The first build downloads images and installs the locked dependencies inside Docker. Startup automatically creates credentials, starts PostgreSQL/pgvector, applies migrations, verifies restricted roles and starts the app. Expect `database` and `app` to be healthy; `credentials` and `bootstrap` exit successfully after setup.

Open [http://localhost:3000](http://localhost:3000) (the Docker `127.0.0.1:3000` link redirects here), continue with Google, then upload or create a resume. Profile creation is optional. Use **Save changes** before downloading a PDF.

The app container runs all four built frontends, gateway/auth/profile/resume services and audit recipient/worker. It uses built assets, without hot reload. Host access is limited to loopback. The container database is separate from a native installation; existing native resumes are not automatically copied.

### 4. Stop, restart and update

```sh
docker compose logs --tail=80 bootstrap app
docker compose down
docker compose up -d --wait --wait-timeout 180
```

Normal `down` preserves database and credential volumes. **Do not add `--volumes` unless you intend to delete all Docker resumes and generated credentials.** Keep the three volumes together when backing up or restoring.

After changing provider values in `.env`, recreate the app:

```sh
docker compose up -d --wait --wait-timeout 180
```

After source changes, rebuild:

```sh
docker compose up -d --build --wait --wait-timeout 180
```

A plain `docker compose restart` does not reload changed environment values. If setup fails, inspect the bootstrap stage in logs. Preserve existing volumes; do not reset passwords to repair a migration error.

### Native development alternative

The Docker path above is recommended for a fresh Windows installation. The native path retains the managed local cluster and supports source watching.

On macOS:

```sh
brew install postgresql@18 pgvector
export PATH="$(brew --prefix postgresql@18)/bin:$PATH"
```

Install the pinned package manager and workspace dependencies:

```sh
corepack enable
corepack prepare pnpm@12.6.0 --activate
pnpm install --frozen-lockfile
```

Configure root `.env` as above. Run initialization once from the primary checkout, in order:

```sh
pnpm db:local:start
pnpm db:migrate
pnpm db:runtime:init
pnpm auth:local:init
pnpm audit:local:init
pnpm dev:personal
```

The native database is `127.0.0.1:55432/resume_forge_dev`. Private administrator/runtime/transport settings are generated in ignored `.local/`. Clear an unrelated shell `DATABASE_URL` before migration. Never replace runtime credentials with administrator access.

`dev:personal` builds dependencies and starts the four MFEs and four services. For native audit delivery, run `pnpm audit:serve:local` and `pnpm audit:worker:local` in separate primary-checkout terminals.

For Git worktrees, initialize native credentials only in the primary checkout. The native launcher resolves it automatically or uses `RESUME_FORGE_LOCAL_ROOT`. Preserve primary `.local/`; do not initialize competing cluster-global passwords. Docker does not use these native files.

## How to run and build

Full local app:

```sh
docker compose up -d --build --wait --wait-timeout 180
docker compose down
```

Run Docker checks/tests in an isolated project. This uses no real provider keys and publishes no host ports:

```sh
docker compose -p forge-docker-test -f compose.yaml -f docker/compose.test.yaml config --quiet
docker compose -p forge-docker-test -f compose.yaml -f docker/compose.test.yaml run --build --rm test
```

The checks image runs workspace lint/typecheck and configured non-database tests. Integration tests cover migrated PostgreSQL/pgvector, runtime permissions, synthetic sign-in, saves/reload/conflicts, owner PDFs, upload, readiness, delete/undo and audit delivery.

Remove only the disposable test project afterward:

```sh
docker compose -p forge-docker-test -f compose.yaml -f docker/compose.test.yaml down --volumes
```

Native workspace commands:

```sh
pnpm dev:personal
pnpm build
pnpm check
pnpm test
```

Native database suites require the PostgreSQL tools and use disposable synthetic databases:

```sh
pnpm db:test
pnpm db:test:roles
pnpm db:test:profile
pnpm db:test:audit
pnpm db:test:vector
```

`pnpm build` writes package `dist/` outputs; it does not deploy a production server. Both supplied runtime modes are local development/demo setups. Stop native processes with Ctrl-C; manage their database with `pnpm db:local:status` and `pnpm db:local:stop`.
