import { createAbstraction } from "@webiny/stdlib";
import type { Command } from "~/cli/abstractions/Command.js";

export interface IRotateKeyCommand extends Command.Interface {}

export const RotateKeyCommand = createAbstraction<IRotateKeyCommand>("Cli/RotateKeyCommand");

export namespace RotateKeyCommand {
  export type Interface = IRotateKeyCommand;
}
