import { createAbstraction } from "@webiny/stdlib";

export interface ISpinner {
  start(message?: string): void;
  stop(message?: string): void;
  message(msg: string): void;
}

export interface ILog {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  step(message: string): void;
  message(message: string): void;
}

export interface IUI {
  intro(title: string): void;
  outro(message: string): void;
  note(message: string, title?: string): void;
  cancel(message: string): void;
  spinner(): ISpinner;
  readonly log: ILog;
}

export const UI = createAbstraction<IUI>("Cli/UI");

export namespace UI {
  export type Interface = IUI;
  export type Spinner = ISpinner;
  export type Log = ILog;
}
