import * as clack from "@clack/prompts";
import { UI as Abstraction } from "./abstractions/UI.js";
import type { ILog, ISpinner } from "./abstractions/UI.js";

class UIImpl implements Abstraction.Interface {
  public readonly log: ILog = {
    info: (message: string) => clack.log.info(message),
    warn: (message: string) => clack.log.warn(message),
    error: (message: string) => clack.log.error(message),
    success: (message: string) => clack.log.success(message),
    step: (message: string) => clack.log.step(message),
    message: (message: string) => clack.log.message(message),
  };

  public intro(title: string): void {
    clack.intro(title);
  }

  public outro(message: string): void {
    clack.outro(message);
  }

  public note(message: string, title?: string): void {
    clack.note(message, title);
  }

  public cancel(message: string): void {
    clack.cancel(message);
  }

  public spinner(): ISpinner {
    return clack.spinner();
  }
}

export { UIImpl };
