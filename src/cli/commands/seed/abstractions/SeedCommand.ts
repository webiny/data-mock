import { createAbstraction } from "@webiny/stdlib";
import type { Command } from "~/cli/abstractions/Command.js";

export interface ISeedCommand extends Command.Interface {}

export const SeedCommand = createAbstraction<ISeedCommand>("Cli/SeedCommand");

export namespace SeedCommand {
  export type Interface = ISeedCommand;
}
