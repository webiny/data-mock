import { createAbstraction } from "@webiny/stdlib";
import type { ICommand } from "~/cli/abstractions/Command.js";

export type IAddProjectCommand = ICommand;

export const AddProjectCommand = createAbstraction<IAddProjectCommand>("Cli/AddProjectCommand");

export namespace AddProjectCommand {
  export type Interface = IAddProjectCommand;
}
