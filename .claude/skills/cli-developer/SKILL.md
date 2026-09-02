---
name: cli-developer
description: >
  Use when building CLI commands in src/cli/. Command structure, DI registration,
  available services (Prompts, UI, DatabaseService, GraphQLService), testing.
  Invoke BEFORE writing any CLI code. References project-architecture for DI patterns.
---

# CLI Developer Guide

CLI lives in `src/cli/`. Run with `yarn cli <command>` (uses tsx). All commands follow the same feature structure defined in **project-architecture**. Shared types, errors, and domain models go in `src/shared/`.

## Command Structure

Every command is a feature with this layout:

```
src/cli/commands/{commandName}/
├── abstractions/
│   ├── {CommandName}Command.ts    # createAbstraction
│   └── index.ts                   # barrel
├── __tests__/
│   └── {CommandName}Command.test.ts
├── {CommandName}Command.ts        # createImplementation
├── feature.ts                     # createFeature, registers command
└── index.ts                       # barrel (abstraction + feature)
```

## Abstraction

```ts
// abstractions/SeedEntriesCommand.ts
import { createAbstraction } from "@webiny/stdlib";

export interface ISeedEntriesCommand {
  execute(): Promise<void>;
}

export const SeedEntriesCommand = createAbstraction<ISeedEntriesCommand>("Cli/SeedEntriesCommand");

export namespace SeedEntriesCommand {
  export type Interface = ISeedEntriesCommand;
}
```

## Implementation

```ts
// SeedEntriesCommand.ts
import { SeedEntriesCommand as Abstraction } from "./abstractions/SeedEntriesCommand.ts";
import { DatabaseService } from "../../abstractions/DatabaseService.ts";
import { Prompts } from "../../abstractions/Prompts.ts";
import { UI } from "../../abstractions/UI.ts";

class SeedEntriesCommandImpl implements Abstraction.Interface {
  public constructor(
    private readonly databaseService: DatabaseService.Interface,
    private readonly prompts: Prompts.Interface,
    private readonly ui: UI.Interface,
  ) {}

  public async execute(): Promise<void> {
    await this.ui.intro("Seed Entries");
    // ...
    await this.ui.outro("Done.");
  }
}

export const SeedEntriesCommand = Abstraction.createImplementation({
  implementation: SeedEntriesCommandImpl,
  dependencies: [DatabaseService, Prompts, UI],
});
```

## Feature + Registration

```ts
// feature.ts
import type { Container } from "@webiny/di";
import { SeedEntriesCommand } from "./SeedEntriesCommand.ts";

export const SeedEntriesFeature = {
  name: "Cli/SeedEntriesFeature",
  register(container: Container) {
    container.register(SeedEntriesCommand).inSingletonScope();
  },
};
```

Register in `src/cli/feature.ts` (CliFeature) and add to the CLI entry point.

## Available Services

All registered in `CliFeature`. Inject via constructor + dependencies array.

| Service | Abstraction | Scope | Purpose |
|---------|-------------|-------|---------|
| Prompts | `Prompts.Interface` | Singleton | text, select, multiselect, confirm |
| UI | `UI.Interface` | Singleton | intro, outro, note, cancel, spinner |
| DatabaseService | `DatabaseService.Interface` | Singleton | SQLite queries for project configs |
| GraphQLService | `GraphQLService.Interface` | Singleton | Execute Webiny CMS GraphQL mutations/queries |
| ProcessEnv | `ProcessEnv.Interface` | Singleton | Typed env var access |
| FileTool | `FileTool.Interface` | Singleton | Read/write files |
| DirectoryTool | `DirectoryTool.Interface` | Singleton | Create directories |

### Prompts — Cancel Handling

All prompt methods return `T | null`. Null means user cancelled. Always handle it:

```ts
const selected = await this.prompts.select({
  message: "Which project?",
  options: projects.map(p => ({ value: p, label: p.name })),
});

if (selected === null) {
  await this.ui.cancel("Cancelled.");
  return;
}
```

### UI — Spinner

```ts
const spinner = await this.ui.spinner();
await spinner.start("Seeding entries...");
await spinner.message("Created 50 entries...");
await spinner.stop("Done. 100 entries created.");
```

### DatabaseService (SQLite)

```ts
// Query project configs
const projects = await this.databaseService.listProjects();
const project = await this.databaseService.getProject(projectId);

// Save project config
await this.databaseService.saveProject({ name, apiUrl, token });
```

### GraphQLService

```ts
// Execute CMS mutations
const result = await this.graphqlService.createEntry(project, modelId, entryData);
const models = await this.graphqlService.listModels(project);
```

## Testing

vitest. Tests should use in-memory SQLite and stub GraphQL responses.

```ts
import { Container } from "@webiny/di";

describe("SeedEntriesCommand", () => {
  let container: Container;
  let command: Abstraction.Interface;

  beforeEach(async () => {
    container = new Container();
    container.register(ProcessEnv).inSingletonScope();
    container.register(DatabaseService).inSingletonScope();
    container.register(SeedEntriesCommand).inSingletonScope();
    command = container.resolve(Abstraction);
  });
});
```

## Pre-Commit

Run before every commit:
- `yarn compile` — TypeScript strict mode
- `yarn lint` — oxlint
- `yarn format:check` — oxfmt
