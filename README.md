# Forge Studio

Forge Studio (resume-forge) is a resume and professional-profile workspace. Sign in with Google, upload an existing resume or create a blank one, edit its sections, save versions, and download the latest saved resume as a PDF.

Key features:

- Resume library with search, sorting, rename, confirmed deletion and undo.
- Editable import review for text-based PDF, DOCX, TXT and Markdown files.
- Section editing, rich text, local undo/redo, three formatting templates and saved appearance.
- General resume readiness and job-description matching with actionable feedback.
- Optional paid Gemini analysis and selected-description rewriting, with review before applying changes.
- Device-aware light/dark themes and an optional master professional profile.

## Tech stack

- pnpm workspaces and Turborepo; TypeScript.
- React 19, Vite 6, Module Federation and React Router 7.
- Tailwind CSS 4, shared shadcn-style primitives, Performative UI, Lucide, React Hook Form and Tiptap.
- Hono services on Node.js; Zod validation; Google OAuth through Arctic.
- PostgreSQL 18, pgvector and Prisma 7.
- PDF.js and Mammoth for import; React PDF for server-side PDF downloads.
- Server-side Gemini REST adapters for optional AI and embeddings.

## Prerequisites

- Git.
- Node.js 22.12+ within the 22.x release line, or Node.js 24+ (Prisma's supported engine range).
- pnpm **12.6.0**, matching `packageManager`.
- PostgreSQL 18 with pgvector installed for that PostgreSQL version. `initdb`, `pg_ctl`, `psql` and `createdb` must be on `PATH`.
- A Google OAuth Web application client for sign-in.
- Optional: a billed Gemini API project for AI features.
- Free local ports 3000–3003, 4000–4003 and 55432; optional audit delivery also uses 4005.

The supplied service configuration supports local development. Run it without `NODE_ENV=production`.

On macOS with Homebrew, install the database tools and expose their binaries:

```sh
brew install postgresql@18 pgvector
export PATH="$(brew --prefix postgresql@18)/bin:$PATH"
```

If pnpm is missing, use Corepack supplied with your Node.js installation:

```sh
corepack enable
corepack prepare pnpm@12.6.0 --activate
pnpm --version
```

## Setup and installation

### 1. Clone and install

```sh
git clone https://github.com/resuming-v2/ResumeForge.git
cd ResumeForge
pnpm install --frozen-lockfile
cp .env.example .env
```

### 2. Configure environment variables

Uncomment and set these variables in the root `.env`:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Register this exact authorized redirect URI in the Google OAuth Web application:

```text
http://localhost:4001/api/v1/auth/google/callback
```

If the consent screen is in testing mode, add your Google account as a test user. Open the app using `http://localhost:3000` so browser origins and cookies match the local configuration. Omit unset OAuth variables rather than assigning empty strings.

For optional AI, also uncomment and set:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
GEMINI_DATA_MODE=paid
```

Set `paid` only for a billed project. The backend requires both settings to enable AI. It uses `gemini-3.5-flash-lite` for analysis/rewrites and `gemini-embedding-001` with 768 dimensions for retrieval. Manual editing, local scoring and PDF downloads work without Gemini. Restart the local stack after changing configuration.

Keep `.env` and `.local/` private. Secrets are server-only; do not add a `VITE_` prefix. No LinkedIn, OpenCode, R2, JWT or Trigger.dev credentials are needed for this local setup.

### 3. Initialize the local database and service credentials

Run once from the primary checkout, in this order:

```sh
pnpm db:local:start
pnpm db:migrate
pnpm db:runtime:init
pnpm auth:local:init
pnpm audit:local:init
```

`db:local:start` creates the managed cluster at `127.0.0.1:55432/resume_forge_dev`. Migrations install the vector extension and tables; the pgvector binaries must already be installed. The scripts generate private configuration:

| File | Generated variables |
| --- | --- |
| `.local/database.env` | `DATABASE_URL` for migrations and database tests |
| `.local/runtime-database.env` | `AUTH_DATABASE_URL`, `PROFILE_DATABASE_URL`, `RESUME_DATABASE_URL`, `AUDIT_RELAY_DATABASE_URL`, `AUDIT_INGEST_DATABASE_URL` |
| `.local/auth-transport.env` | `LOCAL_PROFILE_SERVICE_KEY` |
| `.local/audit-transport.env` | `LOCAL_AUDIT_RELAY_KEY` |

Do not fill these credentials manually or replace runtime URLs with administrator credentials. Clear an unrelated shell `DATABASE_URL` before migration so Prisma uses the generated local file. Preserve `.local/` between runs.

### 4. Run locally

```sh
pnpm dev:personal
```

Open [http://localhost:3000](http://localhost:3000), continue with Google, then upload or create a resume. Profile creation is optional. Use the editor's **Save changes** before downloading a PDF.

`dev:personal` builds shared/backend dependencies and starts all four frontends plus the gateway, auth, profile and resume services. Keep the command running. It refuses to start a second stack on occupied ports.

| Process | Port |
| --- | --- |
| Shell | 3000 |
| Auth / profile / resume remotes | 3001 / 3002 / 3003 |
| Gateway / auth / profile / resume services | 4000 / 4001 / 4002 / 4003 |
| Managed PostgreSQL | 55432 |

To deliver captured audit events, keep these commands running in two additional terminals in the same primary checkout:

```sh
pnpm audit:serve:local
```

```sh
pnpm audit:worker:local
```

The audit recipient listens on `127.0.0.1:4005`. The worker delivers saved outbox events; the main launcher does not start either process.

For a Git worktree, initialize credentials only in the primary checkout. The launcher resolves the Git common directory automatically, or accepts an explicit configuration root:

```sh
RESUME_FORGE_LOCAL_ROOT=/absolute/path/to/primary/ResumeForge pnpm dev:personal
```

Audit helpers read their own checkout's `.local/` files, so run them from the initialized primary checkout. Do not initialize a competing database or copy credential files into another worktree.

## How to run and build

Run commands from the repository root:

```sh
pnpm dev:personal  # Complete local personal app
pnpm build         # Build workspace packages, services and frontends
pnpm check         # Run configured lint and TypeScript checks
pnpm test          # Run configured non-database suites
```

Build outputs are written to each package's `dist/` directory. `pnpm build` does not deploy or start a production server.

Database verification is separate and requires the local PostgreSQL tooling:

```sh
pnpm db:test
pnpm db:test:roles
pnpm db:test:profile
pnpm db:test:audit
pnpm db:test:vector
```

These commands use disposable synthetic databases. To stop the app, press Ctrl-C in its terminals. Manage the local database with:

```sh
pnpm db:local:status
pnpm db:local:stop
```
