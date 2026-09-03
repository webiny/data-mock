import { createAbstraction } from "@webiny/stdlib";

export interface ITextOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string) => string | undefined;
}

export interface ISelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export interface ISelectOptions<T> {
  message: string;
  options: ISelectOption<T>[];
}

export interface IConfirmOptions {
  message: string;
  active?: string;
  inactive?: string;
}

export interface IMultiselectOptions<T> {
  message: string;
  options: ISelectOption<T>[];
  required?: boolean;
}

export interface IPrompts {
  text(opts: ITextOptions): Promise<string | symbol>;
  select<T>(opts: ISelectOptions<T>): Promise<T | symbol>;
  confirm(opts: IConfirmOptions): Promise<boolean | symbol>;
  multiselect<T>(opts: IMultiselectOptions<T>): Promise<T[] | symbol>;
}

export const Prompts = createAbstraction<IPrompts>("Cli/Prompts");

export namespace Prompts {
  export type Interface = IPrompts;
  export type TextOptions = ITextOptions;
  export type SelectOption<T> = ISelectOption<T>;
  export type SelectOptions<T> = ISelectOptions<T>;
  export type ConfirmOptions = IConfirmOptions;
  export type MultiselectOptions<T> = IMultiselectOptions<T>;
}
