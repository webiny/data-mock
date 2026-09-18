---
name: verify-and-stop
description: >
  Prove existing work meets its acceptance conditions without expanding scope. Use for
  validation-only tasks, completion checks, focused gate runs, and last-mile proof.
---

# Verify and stop

Translate the acceptance conditions into the smallest sufficient proof set.

- Reuse results that are still current for the repository state in front of you.
- Run focused checks before wider gates: the single test file, then `yarn test src/<area>`, then
  the full suite.
- Distinguish pass, fail, unavailable, and blocked exactly. "Unavailable" is not "pass".
- Do not edit product code unless the request includes fixes.
- Do not add polish, cleanup, or unrelated tests once the criteria pass.

Gates in this repository:

```bash
yarn typecheck
yarn lint
yarn test
yarn format
yarn adio
```

Stop as soon as the acceptance proof is complete. Report the commands, their results, and any
unresolved risk — nothing else.
