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

## Re-Sync with Change Detection

Available on demand:
- **CLI:** `yarn cli sync-tenants` (select project)
- **UI:** "Sync Tenants" button on project detail page

Re-sync compares remote tenants with local state and reports:

```
Tenant sync for "My Project":
  + tenant-new (New Tenant)     — added remotely
  - tenant-old (Old Tenant)     — removed remotely
  = root (Root)                 — unchanged

Accept changes? [Y/n]
```

### Change Detection Flow

1. Fetch remote tenants from Webiny API
2. Compare with locally stored `project_tenants`
3. Classify each tenant: **added** (remote only), **removed** (local only), **unchanged** (both)
4. Show diff to user
5. On accept: apply the replace (delete + re-insert)
6. On reject: keep local state as-is

### TenantSyncService Output

```ts
interface TenantSyncResult {
  added: Array<{ tenantId: string; name: string }>;
  removed: Array<{ tenantId: string; name: string }>;
  unchanged: Array<{ tenantId: string; name: string }>;
}
```

The auto-sync after project creation skips the confirmation (no prior state to compare against).

## Why Auto-Sync After Create

- Immediate feedback on whether the API key works
- User doesn't need a separate step for common case
- Graceful degradation if tenant listing isn't available
- Manual re-sync with change detection for when tenant setup changes
