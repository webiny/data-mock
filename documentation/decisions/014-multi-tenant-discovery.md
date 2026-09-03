# ADR-014: Multi-Tenant Discovery (After Project Create)

**Date:** 2026-09-03
**Status:** Planned

## Decision

After creating a project, the system automatically:
1. Validates the API key has access (test query against the project's API)
2. Attempts to list tenants — if the token has permission, fetches and stores them
3. If tenant listing fails (no permission), stores only the default tenant

User can re-sync tenants on demand later (button in UI, CLI command).

## Flow

```
Add project
  → Save to DB
  → Test API key (simple query to verify access)
    → Fail? Mark project as "unverified", warn user
    → Success? Continue...
  → Try list tenants
    → Success? Store all in project_tenants
    → Fail (no permission)? Store only default tenant
  → Done
```

## Schema

```
project_tenants
├── id            TEXT PK
├── project_id    TEXT FK → projects.id ON DELETE CASCADE
├── tenant_id     TEXT NOT NULL (e.g., "root", "tenant-abc")
├── name          TEXT NOT NULL
├── discovered_at INTEGER NOT NULL
└── UNIQUE(project_id, tenant_id)
```

## Re-Sync

Available on demand:
- **CLI:** `yarn cli sync-tenants` (select project)
- **UI:** "Sync Tenants" button on project detail page

Re-sync replaces all stored tenants with freshly fetched ones.

## Why Auto-Sync After Create

- Immediate feedback on whether the API key works
- User doesn't need a separate step for common case
- Graceful degradation if tenant listing isn't available
- Manual re-sync for when tenant setup changes
