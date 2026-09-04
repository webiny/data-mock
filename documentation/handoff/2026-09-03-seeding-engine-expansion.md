# Session Handoff — 2026-09-03 — Seeding Engine Expansion

## What was done

11 commits, 147 files changed, +6762 / -2584 lines.

**Project Detail UI Expansion**
- Restructured sidebar: Data tabs (6), Sync section (2), Actions (5)
- URL-driven tab routing via wildcard `/projects/:projectId/*` — no presenter state for active tab
- New tabs: Files, Audit Log, Sync Tenants, Sync Models, Import Entries
- New actions: Edit Project (modal), Push Models (diff preview dialog), Cleanup Seeded Data (confirmation)
- Seed config page embedded inside project detail shell (no standalone route)
- Removed duplicate "Add Project" from project list (header has it globally)

**Seeding Engine (5 features)**
1. **Generate-and-send loop fix** — entries generated one at a time, refs resolve progressively (self-refs work)
2. **Seed config UI overhaul** — group accordion, per-model revisions (exact or range), publish strategy selector, dry-run toggle
3. **Revision engine** — create{Model}From, publish{Model}, unpublish{Model} mutations; configurable revisions per entry with different data each; publish strategy (none/all/random/first/last) with optional unpublish cycles
4. **Import existing entries** — pull from Webiny via paginated list queries, store as "imported" in seed_entries, pre-loaded into availableRefs before seeding
5. **Entry cleanup** — delete seeded entries from Webiny in reverse dependency order, mark as "deleted"

**Sync Logs**
- `sync_logs` table + full-stack feature (API, UI, gateway, repository)
- Sync operations log GraphQL request/response details (URL, query, HTTP status, full response body)
- Monaco editor modals for viewing request (GraphQL) and response (JSON)
- Delete sync logs with confirmation

**Infrastructure**
- Zod validation on 5 GraphQL operation response parsers (listContentModels, listContentModelGroups, listTenants, createContentEntry, listContentEntries)
- `singularApiName` and `pluralApiName` stored on project_models (required, from Webiny API — no guessing)
- Tenant discovery fixed: `listTenants` on `/cms/manage` (not `listWbyTenants`, not old `/graphql` tenancy API)
- `sendError` clamps 2xx status codes to 500 (fixes false success on GraphQL errors)
- Fresh single migration regenerated from schema
- Test coverage: 168 tests across 18 files, v8 coverage provider with thresholds

## Key decisions

- **URL is source of truth for tab selection** — no MobX state for active tab; `subPath` from the wildcard route determines the view
- **No guessing API names** — `singularApiName`/`pluralApiName` come from Webiny's `listContentModels` response, stored in DB, used directly
- **Root tenant always exists** — never filter or skip it
- **Tenant CMS model** — Webiny v6 stores tenants as CMS entries (`listTenants` on `/cms/manage`), hierarchical with parent support
- **Revisions** — each revision regenerates all field values (simulates real edits), ref fields keep same targets
- **Self-referencing models** — entry N can reference entries 1..N-1 (generate-and-send one at a time)
- **Imported entries populate availableRefs** — seeding can reference existing Webiny content
- **Never use Artifacts** — all output in terminal or code files

## Current state

- Branch: `bruno/refactor/project`
- Build: passing (168 tests, 0 type errors, lint clean, format clean)
- Unpushed commits: ~62 (52 from prior session + 11 this session)

## What might come next

- **Browser testing** — run `yarn dev`, test full UI end-to-end (no visual verification done yet)
- **Model sync debugging** — the `listContentModels` query selects `group { id, name, slug }` but Webiny v6 may return `group` as a string; `resolveGroupSlug` handles both but needs live verification
- **Tenant hierarchy** — tenants have parents; the UI could show a tree instead of a flat list
- **AGENTS.md** — just updated but may need further refinement after browser testing reveals issues
- **Test coverage** — at ~53% statements; biggest gaps in generators/validators and field-specific logic
- **Seed scheduling / batch jobs** — mentioned in original roadmap, not started
