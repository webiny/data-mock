import { createTestContainer } from "~/shared/node/testing/createTestContainer.js";
import type { TestContainer } from "~/shared/node/testing/createTestContainer.js";
import type { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { CliFeature } from "~/cli/feature.js";
import { Command } from "~/cli/abstractions/Command.js";
import { Prompts } from "~/cli/abstractions/Prompts.js";
import { UI } from "~/cli/abstractions/UI.js";
import { stubPrompts } from "./StubPrompts.js";
import type { IStubPrompts } from "./StubPrompts.js";
import { stubUI } from "./StubUI.js";
import type { IStubUI } from "./StubUI.js";

export interface ICliTestContainerOptions {
  /** Answers to the command's prompts, in the order it asks them. */
  answers?: unknown[];
  httpClient?: HttpClient.Interface;
}

export interface ICliTestContainer extends TestContainer {
  prompts: IStubPrompts;
  ui: IStubUI;
}

/**
 * The full CLI wiring with the two terminal-facing abstractions replaced.
 *
 * Everything below `Prompts` and `UI` is production code — the same repositories, use cases and
 * SQLite the API runs on — because a command's job is to turn answers into those calls, and a test
 * that stubbed them would only prove the command calls a stub.
 */
export function createCliTestContainer(options: ICliTestContainerOptions = {}): ICliTestContainer {
  const tc = options.httpClient
    ? createTestContainer({ httpClient: options.httpClient })
    : createTestContainer();

  const prompts = stubPrompts(options.answers ?? []);
  const ui = stubUI();

  CliFeature.register(tc.container);
  tc.container.registerInstance(Prompts, prompts.prompts);
  tc.container.registerInstance(UI, ui.ui);

  return { ...tc, prompts, ui };
}

/**
 * Resolves one command the way `src/cli/entry.ts` does — out of everything registered under the
 * `Command` abstraction, by the name it declares. `init` is the exception there and here: it has
 * its own token, because it has to run before the rest of the container can be built.
 */
export function resolveCommand(tc: ICliTestContainer, name: string): Command.Interface {
  for (const command of tc.container.resolveAll(Command)) {
    if (command.name === name) {
      return command;
    }
  }
  throw new Error(`No CLI command named "${name}"`);
}
