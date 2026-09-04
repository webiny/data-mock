import { createAbstraction } from "@webiny/stdlib";
import type { ICommand } from "~/cli/abstractions/Command.js";

export type IRemoveProjectCommand = ICommand;

export const RemoveProjectCommand = createAbstraction<IRemoveProjectCommand>(
  "Cli/RemoveProjectCommand",
);

export namespace RemoveProjectCommand {
  export type Interface = IRemoveProjectCommand;
}
