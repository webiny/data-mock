import { createAbstraction } from "@webiny/stdlib";
import type { ICommand } from "~/cli/abstractions/Command.js";

export type IListProjectsCommand = ICommand;

export const ListProjectsCommand =
  createAbstraction<IListProjectsCommand>("Cli/ListProjectsCommand");

export namespace ListProjectsCommand {
  export type Interface = IListProjectsCommand;
}
