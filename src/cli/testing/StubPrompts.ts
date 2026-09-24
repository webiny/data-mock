import { CANCEL_SYMBOL } from "@clack/prompts";
import type { Prompts } from "~/cli/abstractions/Prompts.js";

export type PromptKind = "text" | "select" | "confirm" | "multiselect";

export interface IRecordedPrompt {
  kind: PromptKind;
  message: string;
  /** Only for select and multiselect: the labels the command offered. */
  labels: string[];
}

export interface IStubPrompts {
  prompts: Prompts.Interface;
  /** Every prompt the command reached, in order. */
  calls: IRecordedPrompt[];
  /** The validators the command attached, keyed by prompt message. */
  validators: Map<string, (value: string | undefined) => string | Error | undefined>;
}

/** What `@clack/prompts` returns when the user presses Ctrl-C. */
export const CANCELLED = CANCEL_SYMBOL;

const PICK = Symbol("stub-prompts:pick");

interface IPickAnswer {
  [PICK]: string[];
}

/**
 * Answers a select by the label the command printed, rather than by the value behind it.
 *
 * Most values a command offers are rows it has just read out of the database — a project, an
 * environment, a tenant — which the test has no handle on when it writes the script. The label is
 * what a user picks from, so it is what the script picks from too.
 */
export function pick(label: string): IPickAnswer {
  return { [PICK]: [label] };
}

/** The multiselect form of {@link pick}. */
export function pickAll(...labels: string[]): IPickAnswer {
  return { [PICK]: labels };
}

function isPick(value: unknown): value is IPickAnswer {
  return typeof value === "object" && value !== null && PICK in value;
}

/**
 * Answers a command's prompts from a script, in the order the command asks.
 *
 * Order rather than message matching: what a command asks, and in what order, is part of what the
 * tests are pinning. A command that asks one question too many runs out of script and says so,
 * rather than quietly reusing an answer meant for something else.
 */
export function stubPrompts(answers: unknown[]): IStubPrompts {
  const remaining = [...answers];
  const calls: IRecordedPrompt[] = [];
  const validators = new Map<string, (value: string | undefined) => string | Error | undefined>();

  /**
   * The one cast in this file. A script is a list of answers of whatever shape the command under
   * test expects, which is the same boundary a JSON parse sits on: the value is untyped until a
   * caller says what it is.
   */
  function next<T>(kind: PromptKind, message: string, labels: string[] = []): T {
    calls.push({ kind, message, labels });
    if (remaining.length === 0) {
      throw new Error(`Unscripted ${kind} prompt: "${message}"`);
    }
    return remaining.shift() as T;
  }

  function resolve<T>(
    answer: IPickAnswer,
    options: Prompts.SelectOption<T>[],
    message: string,
  ): T[] {
    return answer[PICK].map((label) => {
      const option = options.find((candidate) => candidate.label === label);
      if (!option) {
        const offered = options.map((candidate) => candidate.label).join(", ");
        throw new Error(`"${label}" was not offered by "${message}". Offered: ${offered}`);
      }
      return option.value;
    });
  }

  const prompts: Prompts.Interface = {
    async text(options: Prompts.TextOptions): Promise<string | symbol> {
      if (options.validate) {
        validators.set(options.message, options.validate);
      }
      return next<string | symbol>("text", options.message);
    },
    async select<T>(options: Prompts.SelectOptions<T>): Promise<T | symbol> {
      const answer = next<T | symbol>(
        "select",
        options.message,
        options.options.map((option) => option.label),
      );
      return isPick(answer) ? resolve(answer, options.options, options.message)[0]! : answer;
    },
    async confirm(options: Prompts.ConfirmOptions): Promise<boolean | symbol> {
      return next<boolean | symbol>("confirm", options.message);
    },
    async multiselect<T>(options: Prompts.MultiselectOptions<T>): Promise<T[] | symbol> {
      const answer = next<T[] | symbol>(
        "multiselect",
        options.message,
        options.options.map((option) => option.label),
      );
      return isPick(answer) ? resolve(answer, options.options, options.message) : answer;
    },
  };

  return { prompts, calls, validators };
}
