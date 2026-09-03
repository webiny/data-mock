import { createAbstraction } from "@webiny/stdlib";

export interface ICommand {
  readonly name: string;
  readonly description: string;
  execute(): Promise<void>;
}

export const Command = createAbstraction<ICommand>("Cli/Command");

export namespace Command {
  export type Interface = ICommand;
}
