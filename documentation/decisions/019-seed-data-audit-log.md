# ADR-019: Seed Data Audit Log

**Date:** 2026-09-03
**Status:** Planned

## Context

We need a full audit trail of what data was inserted into each project. At any point in time, we should be able to answer: what entries exist in this project that we created, when, how many, to which tenant, with what field values.

## Decision

Store every seeded entry as a JSON record in SQLite with metadata. This is separate from the `seed_jobs` table (which tracks job-level status) — this is entry-level data.

## Schema

```
seed_entries
├── id            TEXT PK
├── job_id        TEXT FK → seed_jobs.id ON DELETE CASCADE
├── project_id    TEXT FK → projects.id ON DELETE CASCADE
├── tenant        TEXT NOT NULL
├── model_id      TEXT NOT NULL
├── entry_id      TEXT NOT NULL (Webiny's returned entry ID)
├── entry_data    TEXT NOT NULL (JSON — the full entry values as sent)
├── response_data TEXT (JSON — Webiny's response, if stored)
├── status        TEXT NOT NULL (created | failed | dry-run)
├── http_status   INTEGER (HTTP status code from Webiny response)
├── error         TEXT (error message if failed)
├── created_at    INTEGER NOT NULL
```

## What Gets Stored

For each entry created during seeding:
- **entry_data** — the exact JSON payload sent to Webiny (field values)
- **response_data** — Webiny's response (entry ID, created timestamp)
- **Metadata** — which project, tenant, model, job, when, status

## Queries This Enables

```sql
-- What did we insert into project X?
SELECT * FROM seed_entries WHERE project_id = ? ORDER BY created_at DESC

-- What entries exist for model "blogArticle" in tenant "root"?
SELECT * FROM seed_entries WHERE project_id = ? AND model_id = 'blogArticle' AND tenant = 'root'

-- How many entries per model in project X?
SELECT model_id, COUNT(*) as count FROM seed_entries WHERE project_id = ? GROUP BY model_id

-- What failed?
SELECT * FROM seed_entries WHERE status = 'failed'

-- What was seeded in job Y?
SELECT * FROM seed_entries WHERE job_id = ?

-- Full audit: when, what, where
SELECT se.created_at, se.tenant, se.model_id, se.status, sj.id as job_id
FROM seed_entries se
JOIN seed_jobs sj ON se.job_id = sj.id
WHERE se.project_id = ?
ORDER BY se.created_at DESC
```

## Integration

### SeedService Update
After each successful entry creation:
1. Store the sent data + Webiny's response in `seed_entries`
2. On failure, store with status "failed" and error message
3. On dry-run, store with status "dry-run" (no response_data)

### API Routes
```
GET /api/projects/:id/entries                    — list all seeded entries (paginated)
GET /api/projects/:id/entries?model=blogArticle  — filter by model
GET /api/projects/:id/entries?tenant=root        — filter by tenant
GET /api/projects/:id/entries?jobId=xxx          — filter by job
GET /api/projects/:id/entries/:entryId           — get single entry with full data
DELETE /api/projects/:id/entries                  — clear audit log for project
```

### CLI
```
yarn cli list-entries  — select project → show entry count per model/tenant
yarn cli export-entries — select project → export entries as JSON file
```

### UI
Project detail page → Seed History tab → click a job → see all entries for that job
With filters: model, tenant, status

## Data Retention

- Entries accumulate over time — consider a cleanup/purge mechanism
- Export to JSON before purging
- The `entry_data` column can be large — consider compressing or storing to files for very large datasets

## Why JSON in SQLite

- Queryable with SQLite JSON functions if needed
- No schema migration needed when Webiny model fields change
- Easy to export as-is
- Compact enough for typical seeding volumes (thousands of entries)
