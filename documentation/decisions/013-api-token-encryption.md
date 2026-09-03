# ADR-013: Encrypt API Tokens at Rest

**Date:** 2026-09-03
**Status:** Planned (not yet implemented)

## Decision

API tokens stored in SQLite must be encrypted at rest. The encryption key comes from a `.env` variable (e.g., `ENCRYPTION_KEY`).

## Approach

- Use AES-256-GCM (Node.js `crypto` module) for symmetric encryption
- Key loaded from `ENCRYPTION_KEY` in `.env` via ProcessEnvFeature
- Encrypt before writing to `api_token` column, decrypt on read
- Wrap in an `EncryptionService` abstraction registered via DI
- ProjectRepository uses EncryptionService for token fields

## When

After core refactoring is complete. Tracked as a follow-up task.

## Notes

- `.env` must be gitignored (already is)
- If `ENCRYPTION_KEY` is missing, fail loudly at startup — don't store tokens in plaintext
- Consider key rotation support in the future
