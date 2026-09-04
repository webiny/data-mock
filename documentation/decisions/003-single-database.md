# ADR-003: Single Central Database

**Date:** 2026-09-02
**Status:** Accepted

## Context

Need to store configuration for multiple Webiny project connections. Two options: one central SQLite DB with a `projects` table, or one DB file per project.

## Decision

One central SQLite database (`.webiny/data-mock.db`) with a `projects` table holding all connections.

## Rationale

- Simpler to manage, query across projects, and back up
- Single connection for the API server
- Easy to list/filter all projects from the UI
- Seed job history lives alongside project configs in the same DB
