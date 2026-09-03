import { createAbstraction } from "@webiny/stdlib";
import type { Command } from "~/cli/abstractions/Command.js";

export interface ISyncModelsCommand extends Command.Interface {}

export const SyncModelsCommand = createAbstraction<ISyncModelsCommand>("Cli/SyncModelsCommand");

export namespace SyncModelsCommand {
  export type Interface = ISyncModelsCommand;
}
