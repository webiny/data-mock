---
name: cli-developer
description: >
  Use when building CLI commands in src/cli/. Command structure, DI registration,
  the Prompts and UI abstractions, cancel handling, and testing through createCliTestContainer.
  Invoke BEFORE writing any CLI code. References project-architecture for DI patterns.
---

# CLI Developer Guide

CLI lives in `src/cli/`. Run with `yarn cli <command>` (uses tsx). All commands follow the same feature structure defined in **project-architecture**. Shared types, errors, and domain models go in `src/shared/`.

## Command Structure

Every command is a feature with this layout:

```
src/cli/commands/{commandName}/
├── __tests__/
│   └── {CommandName}Command.test.ts
├── {CommandName}Command.ts        # createImplementation against the shared Command abstraction
└── feature.ts                     # createFeature, registers command
```

**Commands do NOT get an abstraction of their own.** They register under the shared
`Command` abstraction (`src/cli/abstractions/Command.ts`), because `src/cli/entry.ts` builds its
command map with `container.resolveAll(Command)` and dispatches on `name`. A per-command token is
never resolved by anything, so seven of them sat unused until they were deleted.

`init` is the one exception, and it has its own token for a reason: it runs before the rest of the
container can be built, so `entry.ts` resolves it directly rather than through `resolveAll`.

## Implementation

```ts
// SeedEntriesCommand.ts
import { Command } from "~/cli/abstractions/Command.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { SeedService } from "~/shared/node/features/seeding/seed/abstractions/SeedService.js";

class SeedEntriesCommandImpl implements Command.Interface {
  public readonly name = "seed-entries";
  public readonly description = "Seed mock entries into a Webiny project";

  public constructor(
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
    private readonly seedService: SeedService.Interface,
  ) {}

  public async execute(): Promise<void> {
    this.ui.intro("Seed Entries");
    // ...
    this.ui.outro("Done.");
  }
}

export const SeedEntriesCommand = Command.createImplementation({
  implementation: SeedEntriesCommandImpl,
  dependencies: [Prompts, UI, SeedService],
});
```

`name` and `description` are what the dispatcher and `yarn cli help` read, so both are required.

## Feature + Registration

```ts
// feature.ts
import { createFeature } from "@webiny/stdlib";
import { SeedEntriesCommand } from "./SeedEntriesCommand.js";

export const SeedEntriesFeature = createFeature({
  name: "Cli/SeedEntriesFeature",
  register(container) {
    container.register(SeedEntriesCommand).inSingletonScope();
  },
});
```

Register the feature in `src/cli/feature.ts` (CliFeature). Nothing else is needed: `entry.ts`
finds the command through `resolveAll(Command)` and lists it in the help output automatically.

## Available Services

`Prompts` and `UI` are registered in `CliFeature`. Everything else a command needs — repositories,
use cases, services — comes from `AppFeature` (`src/shared/node/feature.js`), the same wiring the
API uses. Inject through the constructor and list the abstraction in `dependencies`.

| Service | Abstraction | Purpose |
|---------|-------------|---------|
| Prompts | `Prompts.Interface` | text, select, multiselect, confirm |
| UI | `UI.Interface` | intro, outro, note, cancel, spinner, log |

There is no `DatabaseService` or `GraphQLService`. Read through the feature repositories
(`ListProjectsUseCase`, `ListProjectTenantsRepository`, …) and write through the services
(`SeedService`, `SyncModelsService`, `KeyRotationService`, …). Everything returns a `Result`.

### Prompts — Cancel Handling

Every prompt returns `T | symbol`, where the symbol is @clack's cancel. Narrow it with
`isCancelled` — a bare `=== null` check is wrong, and TypeScript will not narrow `typeof CANCEL`
out of `string | symbol` on its own:

```ts
import { isCancelled } from "~/cli/abstractions/isCancelled.js";

const selected = await this.prompts.select({
  message: "Which project?",
  options: projects.map((p) => ({ value: p, label: p.name })),
});

if (isCancelled(selected)) {
  this.ui.cancel("Cancelled.");
  return;
}
```

For an environment, use `selectEnvironment(prompts, ui, environments)` rather than prompting
directly: with exactly one it is selected and reported instead of asking a question that has only
one answer.

### UI

`UI` is synchronous — nothing here is awaited.

```ts
this.ui.intro("Seed Entries");
this.ui.log.warn("No models synced. Run 'yarn cli sync-models' first.");

const spinner = this.ui.spinner();
spinner.start("Seeding entries...");
spinner.message("Created 50 entries...");
spinner.stop("Done. 100 entries created.");

this.ui.outro("Done.");
```

Pick the channel deliberately: `log.error` for a failure, `log.warn` for a state the user has to
act on, `log.info` for a fact, `cancel` for a deliberate abort. A failed write reported on `info`
reads as success.

**Report every failed `Result`.** A dropped `isFail()` leaves the user believing the thing
happened — that is how a template that could not be saved was reported as saved.

## Testing

vitest, through `createCliTestContainer()` (`src/cli/testing/`). Only `Prompts` and `UI` are
replaced — everything below them is production code, in-memory SQLite included, because a command's
job is to turn answers into those calls and a test that stubbed them would only prove the command
calls a stub.

- `answers` is a script, consumed in the order the command asks. A command that asks one question
  too many runs out of script and says so, rather than reusing an answer meant for something else.
- Answer a select with `pick("Blog")` — by the label the command printed, not the value behind it.
  The values it offers are rows it has just read, which the test has no handle on. `pickAll(...)`
  is the multiselect form, `CANCELLED` is Ctrl-C.
- `tc.ui.on("error")` reads one channel, `tc.ui.said(fragment)` searches them all. Assert on the
  channel too: the same sentence on `info` and on `error` are different products.
- `tc.prompts.validators.get(message)` returns the validator the command attached, so the input
  rules are testable without driving the prompt.
- Stub a service with `tc.container.registerInstance(SomeService, { execute: async () => ... })`
  before resolving the command.

```ts
import { createCliTestContainer, resolveCommand } from "~/cli/testing/createCliTestContainer.js";
import { pick, CANCELLED } from "~/cli/testing/StubPrompts.js";
import { createTestProject } from "~/shared/node/testing/createTestProject.js";

it("archives by default, destroying nothing", async () => {
  const tc = createCliTestContainer({ answers: [pick("Blog"), "archive"] });
  await createTestProject(tc, { name: "Blog" });

  await resolveCommand(tc, "remove-project").execute();

  expect(tc.ui.said('Project "Blog" archived')).toBe(true);
});
```

`resolveCommand(tc, name)` resolves through `resolveAll(Command)`, the same path `entry.ts` takes.
`init` is resolved by its own token instead.

**Never point a test at the repository's own `.env`.** `init` and `rotate-key` write the `.env` in
`process.cwd()`; stub `process.cwd()` to a temp directory first. It is the one file here whose
contents are not recoverable.

## Pre-Commit

Run before every commit:
- `yarn typecheck` — TypeScript strict mode
- `yarn lint` — oxlint
- `yarn format:check` — oxfmt
