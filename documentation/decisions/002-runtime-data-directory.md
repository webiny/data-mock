# ADR-002: Runtime Data Directory

**Date:** 2026-09-02
**Status:** Accepted

## Context

The project needs a location for runtime data: SQLite database, file cache, and logs. This data must not be committed to git.

## Decision

All runtime data lives in `.webiny/` at the project root.

```
.webiny/
├── data-mock.db          # SQLite database
├── cache/                # File cache (API response caching)
└── logs/                 # Log files (if file logging is enabled)
```

## Rationale

- `.webiny/` is already in `.gitignore`
- Familiar location for Webiny tooling
- Single directory to back up or reset
- Default DB path: `.webiny/data-mock.db`
