import { createAbstraction } from "@webiny/stdlib";
import type { Command } from "~/cli/abstractions/Command.js";

export interface IPushModelsCommand extends Command.Interface {}

export const PushModelsCommand = createAbstraction<IPushModelsCommand>("Cli/PushModelsCommand");

export namespace PushModelsCommand {
  export type Interface = IPushModelsCommand;
}
