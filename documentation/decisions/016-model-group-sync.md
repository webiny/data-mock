# ADR-016: Model & Group Sync with Change Detection

**Date:** 2026-09-03
**Status:** Implemented

## Context

The tool needs to manage CMS content model groups and models on Webiny projects. This includes:
- Creating groups and models on target projects (push)
- Pulling groups and models from live projects (sync)
- Detecting differences between local state and remote state
- Notifying users of changes and letting them decide what to do

## Concepts

### Local State
Models and groups stored in SQLite, tied to a project. This is what the tool "knows about" — the expected state.

### Remote State
Models and groups on the live Webiny CMS. Fetched via GraphQL API. This is the actual state.

### Sync
Comparing local vs remote and detecting differences.

## Schema

```
project_groups
├── id            TEXT PK
├── project_id    TEXT FK → projects.id ON DELETE CASCADE
├── slug          TEXT NOT NULL
├── name          TEXT NOT NULL
├── description   TEXT
├── icon          TEXT
├── remote_id     TEXT (Webiny's internal ID, null if not yet pushed)
├── synced_at     INTEGER
├── created_at    INTEGER NOT NULL
└── UNIQUE(project_id, slug)

project_models
├── id            TEXT PK
├── project_id    TEXT FK → projects.id ON DELETE CASCADE
├── group_slug    TEXT NOT NULL
├── model_id      TEXT NOT NULL (e.g., "blogArticle")
├── name          TEXT NOT NULL
├── description   TEXT
├── fields        TEXT NOT NULL (JSON — full field definitions)
├── remote_id     TEXT (Webiny's internal ID)
├── synced_at     INTEGER
├── created_at    INTEGER NOT NULL
├── updated_at    INTEGER NOT NULL
└── UNIQUE(project_id, model_id)
```

## Operations

### Push (Create/Update on Webiny)
```
Local models → GraphQL mutations → Webiny CMS
```
- Create groups that don't exist remotely
- Create models that don't exist remotely
- Optionally update models that differ

### Pull (Fetch from Webiny)
```
Webiny CMS → GraphQL queries → Local store
```
- Fetch all groups and models from the project
- Store in SQLite with `synced_at` timestamp

### Compare (Diff Detection)
```
Local state ←→ Remote state → Diff report
```
For each model, compare:
- Field count (added/removed fields)
- Field types changed
- Field validation rules changed
- Field settings changed (predefined values, etc.)
- Model-level changes (name, description, group assignment)

### User Decision Flow
When differences are detected:

```
Sync detected 3 changes:
  1. Model "blogArticle" — field "body" type changed from "rich-text" to "long-text"
  2. Model "blogArticle" — new field "subtitle" (text) added remotely
  3. Model "carMake" — field "country" removed remotely

For each change:
  [Accept remote] — update local to match remote
  [Keep local] — keep local state (push later if desired)
  [Skip] — ignore for now
```

## Directory Structure

```
src/shared/node/features/models/
├── abstractions/
├── sync/
│   ├── SyncModelsService.ts        # Fetches remote models, stores locally
│   ├── CompareModelsService.ts     # Diffs local vs remote
│   └── abstractions/
├── push/
│   ├── PushModelsService.ts        # Creates/updates models on Webiny
│   └── abstractions/
├── list/
│   ├── ListProjectModelsRepository.ts
│   └── abstractions/
├── store/
│   ├── StoreProjectModelRepository.ts
│   └── abstractions/
└── feature.ts
```

## API Routes (for UI)

```
GET    /api/projects/:id/models          — list local models
POST   /api/projects/:id/models/sync     — trigger sync (pull from Webiny)
GET    /api/projects/:id/models/diff     — compare local vs remote
POST   /api/projects/:id/models/push     — push local models to Webiny
PATCH  /api/projects/:id/models/:modelId — accept/reject individual changes
```

## CLI Commands

```
yarn cli sync-models    — select project → pull models from Webiny
yarn cli push-models    — select project → push local models to Webiny
yarn cli diff-models    — select project → show differences
```

## Why Store Models Locally

- Offline field introspection for the generator system
- Track what models were created by this tool vs. existing ones
- Detect drift between tool's expected state and live system
- Enable "dry run" seeding without API access (use cached model definitions)
