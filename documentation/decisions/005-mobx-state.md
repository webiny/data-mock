# ADR-005: MobX for UI State Management

**Date:** 2026-09-02
**Status:** Accepted

## Decision

Use MobX for observable state in presenters, matching the reference project pattern.

## How It Works

- Presenters use `makeAutoObservable(this)` in constructor
- State exposed via computed `get vm()` getter returning a plain object
- React components wrapped with `observer()` — dumb display only
- Use cases update repository state; presenter recomputes vm automatically

## Dependencies to Add

```
mobx, mobx-react-lite
```
