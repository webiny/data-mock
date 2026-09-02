# ADR-006: No Auth, Localhost Only

**Date:** 2026-09-02
**Status:** Accepted

## Decision

The local Fastify server binds to `127.0.0.1` only, with no authentication middleware.

## Rationale

This is a local dev tool, not a shared service. API tokens are stored in SQLite but the server is only accessible from the local machine. No auth middleware from the reference project is needed.

If team usage is needed later, simple token auth can be added as a decorator on the Fastify server abstraction.
