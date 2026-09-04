# ADR-017: Project Detail Page

**Date:** 2026-09-03
**Status:** Planned

## Context

The project list page shows cards with basic info. There's no way to drill into a project and see its full state — tenants, models, groups, seed history, etc.

## Decision

Add a project detail page accessible by clicking a project card. It shows the complete state of a project.

## Page Sections

### Header
- Project name, API URL, Webiny version badge
- Edit project / Remove project buttons
- Last synced timestamp

### Tenants Tab
- List of discovered tenants (tenant ID, name, discovered date)
- "Sync Tenants" button with diff display
- Note: models are global (not per-tenant) in Webiny — but seeding IS per-tenant

### Models & Groups Tab
- Groups listed with their models nested under them
- Each model shows: name, model ID, field count, last synced
- Expandable: click model to see field definitions (type, validation rules)
- "Sync Models" / "Push Models" buttons
- Note: some models are plugin-based (global, not tenant-specific)

### Seed History Tab
- Table of past seed jobs for this project
- Columns: date, tenant, models seeded, entries created, errors, status (completed/failed/dry-run), duration
- Click to see details (which models, how many per model, error messages)

### Seed Templates Tab
- Saved seed configurations for this project
- Load template → pre-fills seed config
- Delete template

### Quick Actions
- "Seed Data" → opens seed config with project pre-selected
- "Sync All" → syncs tenants + models in one action

## API Routes Needed

```
GET /api/projects/:id                    — already exists
GET /api/projects/:id/tenants            — already exists
GET /api/projects/:id/models             — already exists
GET /api/projects/:id/groups             — needed (or include in models response)
GET /api/projects/:id/seed-jobs          — already exists
GET /api/projects/:id/templates          — already exists
```

Most routes already exist — the UI just needs to consume them.

## Navigation

From project list → click card → project detail page (via MobX router: `navigate("project-detail", { projectId })`)
