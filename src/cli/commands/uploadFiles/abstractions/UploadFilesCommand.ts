import { createAbstraction } from "@webiny/stdlib";
import type { Command } from "~/cli/abstractions/Command.js";

export interface IUploadFilesCommand extends Command.Interface {}

export const UploadFilesCommand = createAbstraction<IUploadFilesCommand>("Cli/UploadFilesCommand");

export namespace UploadFilesCommand {
  export type Interface = IUploadFilesCommand;
}
