import { createAbstraction } from "@webiny/stdlib";
import type { Command } from "~/cli/abstractions/Command.js";

export interface IInitCommand extends Command.Interface {}

export const InitCommand = createAbstraction<IInitCommand>("Cli/InitCommand");

export namespace InitCommand {
  export type Interface = IInitCommand;
}
