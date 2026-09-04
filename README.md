# Webiny Data Mock

A multi-project tool for generating and seeding mock data into Webiny CMS instances. Manages project connections (encrypted), syncs models/groups/tenants from live Webiny, generates realistic fake data respecting CMS field validation, and sends entries via GraphQL. Includes a CLI, REST API, and web UI.

## Quick Start

### 1. Install dependencies

```bash
yarn install
```

### 2. Initialize environment

```bash
yarn cli init
```

This generates a `.env` file with a random encryption key and default port config:

```
ENCRYPTION_KEY=<64-char hex>
API_PORT=4000
UI_PORT=4001
```

### 3. Add a project

**Option A: Via CLI**

```bash
yarn cli add-project
```

Prompts for project name, Webiny API URL, API token, tenant, and version.

**Option B: Via seed file (recommended for teams)**

Create `.projects.json` in the project root:

```json
[
  {
    "name": "My Webiny Project",
    "apiUrl": "https://your-api.webiny.com",
    "apiToken": "your-api-token",
    "tenant": "root",
    "webinyVersion": "6.0.0"
  }
]
```

Projects are upserted by name on every server start. The API token is encrypted before storage. See `.projects.json.example` for the format.

> **Important:** `.projects.json` contains real API tokens — it is gitignored. Never commit it. Only `.projects.json.example` with placeholder values is tracked.

### 4. Start the dev server

```bash
yarn dev
```

This starts both the API server (port 4000) and the UI (port 4001) with hot reload.

Open **http://localhost:4001** in your browser.

### 5. Sync models and seed data

1. Open a project in the UI
2. Click **Sync Tenants** to discover tenants
3. Click **Sync Models** to pull CMS model definitions
4. Go to **Seed Data** — select models, amounts, and click **Start Seed**

All operations run as background jobs with real-time progress via WebSocket.

## CLI Usage

| Command | Description |
|---|---|
| `yarn cli init` | Generate `.env` with encryption key + port config |
| `yarn cli add-project` | Add a Webiny project interactively |
| `yarn cli list-projects` | Show all configured projects |
| `yarn cli remove-project` | Select + confirm + remove a project |
| `yarn cli sync-models` | Pull models/groups from a Webiny project |
| `yarn cli seed` | Generate + send mock entries (select project → tenants → models → amounts) |
| `yarn cli rotate-key` | Rotate the API token encryption key |
| `yarn cli upload-files` | Upload files to a Webiny project's file manager |

## Architecture

```
CLI (src/cli/)        → shared services (src/shared/node/)
API (src/api/)        → shared services
UI  (src/ui/)         → API via HTTP + WebSocket
```

- **Shared layer** (`src/shared/node/`): SQLite persistence, GraphQL client, generators, job execution
- **API layer** (`src/api/`): Fastify REST + WebSocket server
- **UI layer** (`src/ui/`): React + Mantine + MobX
- **DI**: `@webiny/di` container with abstractions/implementations pattern

### Background Jobs

All long-running operations (seed, sync, import, cleanup) run as background jobs:

1. API route enqueues a job → returns 202 with job ID
2. JobWorker polls every 3s, picks up pending jobs, runs executor
3. Progress + logs pushed to UI via WebSocket in real-time
4. UI shows toast notification on completion/failure
5. Affected data auto-refreshes in the UI

Job types: `seed`, `sync-tenants`, `sync-models`, `cleanup`, `import`.

### Audit Log

Every seeded entry is logged with:
- **Request**: full GraphQL mutation, variables, URL (auth token redacted)
- **Response**: complete raw HTTP response from Webiny
- **Error**: error message if the mutation failed

Click any entry in the Audit Log tab to see the full request/response detail.

## Development

| Script | Command | Purpose |
|---|---|---|
| `yarn dev` | `concurrently` | API + UI together |
| `yarn cli` | `tsx src/cli/entry.ts` | CLI tool |
| `yarn api:dev` | `tsx --watch src/api/entry.ts` | API server only |
| `yarn ui:dev` | `vite dev` | UI dev server only |
| `yarn typecheck` | `tsc --noEmit` | Type checking |
| `yarn test` | `vitest run` | Run tests |
| `yarn test:watch` | `vitest` | Watch mode |
| `yarn lint` | `oxlint` | Lint check |
| `yarn format:check` | `oxfmt --check` | Format check |
| `yarn db:generate` | `drizzle-kit generate` | Generate DB migration |

**Before every commit:** `yarn lint && yarn format:check && yarn typecheck && yarn test`

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ENCRYPTION_KEY` | Yes | — | 64-char hex for AES-256-GCM token encryption |
| `API_PORT` | No | 4000 | Fastify server port |
| `UI_PORT` | No | 4001 | Vite dev server port |
| `DB_PATH` | No | `.webiny/data-mock.db` | SQLite database path |

## Runtime Data

All runtime data is stored in `.webiny/` (gitignored):

```
.webiny/
├── data-mock.db    # SQLite database
├── cache/          # File cache
└── logs/           # Log files
```

## Project Seed File

`.projects.json` is read on every server start. Projects are matched by name — existing projects are updated, new ones are inserted. This is the recommended way to share project connections across a team (each developer creates their own `.projects.json` from the example).

```bash
cp .projects.json.example .projects.json
# Edit .projects.json with your real values
```
