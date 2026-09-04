import * as clack from "@clack/prompts";
import { Prompts as Abstraction } from "./abstractions/Prompts.js";
import type { ISelectOption } from "./abstractions/Prompts.js";

type ClackOption<T> = Parameters<typeof clack.select<T>>[0]["options"][number];

function toClackOptions<T>(options: ISelectOption<T>[]): ClackOption<T>[] {
  return options.map(
    (o) =>
      ({
        value: o.value,
        label: o.label,
        hint: o.hint,
      }) as ClackOption<T>,
  );
}

class PromptsImpl implements Abstraction.Interface {
  public async text(opts: Abstraction.TextOptions): Promise<string | symbol> {
    return clack.text(opts);
  }

  public async select<T>(opts: Abstraction.SelectOptions<T>): Promise<T | symbol> {
    return clack.select({
      message: opts.message,
      options: toClackOptions(opts.options),
    }) as Promise<T | symbol>;
  }

  public async confirm(opts: Abstraction.ConfirmOptions): Promise<boolean | symbol> {
    return clack.confirm(opts);
  }

  public async multiselect<T>(opts: Abstraction.MultiselectOptions<T>): Promise<T[] | symbol> {
    return clack.multiselect({
      message: opts.message,
      options: toClackOptions(opts.options),
      required: opts.required,
    } as Parameters<typeof clack.multiselect<T>>[0]) as Promise<T[] | symbol>;
  }
}

export const Prompts = Abstraction.createImplementation({
  implementation: PromptsImpl,
  dependencies: [],
});
