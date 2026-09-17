---
name: safe-refactor
description: >
  Restructure code while preserving behavior. Use for extraction, consolidation, ownership moves,
  or cleanup where verification must bracket the structural edits — and for any refactor split
  across several agents working in the same tree.
---

# Safe refactor

Define the behavior-preservation boundary and establish verification *before* the structural edits.

- Keep feature changes outside the refactor. A refactor that fixes a bug on the way hides the bug.
- Move one ownership boundary at a time.
- Preserve public interfaces, failure behavior, ordering, and compatibility unless the scope says otherwise.
- Keep every intermediate state buildable and testable. New code lands beside the old; the old one
  is deleted in a separate, deliberate step once nothing imports it.
- Do not grow dependencies or configuration without a correctness need.

Run the same proof after the change as before it. Stop when behavior matches and the requested
structure is reached.

## Verification gates (this repository)

Run in this order; each one must be clean before the next matters:

```bash
yarn typecheck     # 0 errors
yarn lint          # 0 warnings
yarn test          # all green
yarn format        # clean
yarn adio          # no architecture violations
```

For a UI refactor, `yarn test src/ui` is the fast inner loop; the full suite is the gate.

## Architecture rules that a refactor must not break

These come from `AGENTS.md` and are not negotiable during restructuring:

- Abstractions live in `abstractions/`, one per file. Implementations live beside `feature.ts`,
  never in `abstractions/`.
- Never export an `Impl` class. Only the `createImplementation` result is exported.
- **Rule 13** — barrels export abstractions only, never a feature, never an implementation.
- **Rule 14** — an implementation is never imported outside its own domain directory. In practice
  its only importer is that domain's `feature.ts`.
- Constructor dependencies are `private readonly`, with explicit access modifiers on all methods.
- `Result<T, E>` everywhere; nothing throws for an expected failure.
- Scope: Gateway / Repository / Service singleton, UseCase and Presenter transient.
- React owns *when* data is fetched; the presenter owns *how*. A component effect triggers the
  load; the presenter never remembers which view is on screen in order to re-fetch for itself.
- A presenter test must observe. `vm` is a MobX computed — reading it without an `autorun` proves
  nothing about what a real view would see.

## Working in parallel

When several agents refactor the same tree at once:

- Every agent owns an explicit, disjoint list of paths. An agent never edits a file outside its
  list, and never edits a shared file — the coordinator owns those.
- New structure is additive. An agent creates its own directory; it does not delete the code it
  replaces, because the file that still imports it belongs to somebody else.
- If an agent needs a change in a file it does not own, it reports the change rather than making it.
- An agent verifies with the gates above, scoped to what it wrote.
