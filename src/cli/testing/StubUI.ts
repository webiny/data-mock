import type { UI } from "~/cli/abstractions/UI.js";

export type UIChannel =
  | "intro"
  | "outro"
  | "note"
  | "cancel"
  | "info"
  | "warn"
  | "error"
  | "success"
  | "step"
  | "message"
  | "spinner:start"
  | "spinner:stop"
  | "spinner:message";

export interface IRecordedOutput {
  channel: UIChannel;
  text: string;
}

export interface IStubUI {
  ui: UI.Interface;
  /** Everything the command printed, in order and with the channel it printed on. */
  output: IRecordedOutput[];
  /** The text printed on one channel, in order. */
  on(channel: UIChannel): string[];
  /** True when any channel carried text containing `fragment`. */
  said(fragment: string): boolean;
}

/**
 * Records what a command printed instead of drawing it.
 *
 * The channel matters as much as the text: "no API to reach" on `info` and the same sentence on
 * `error` are different products, so the tests assert on both.
 */
export function stubUI(): IStubUI {
  const output: IRecordedOutput[] = [];

  function record(channel: UIChannel): (text?: string) => void {
    return (text = "") => {
      output.push({ channel, text });
    };
  }

  const ui: UI.Interface = {
    intro: record("intro"),
    outro: record("outro"),
    note: (message, title) => {
      output.push({
        channel: "note",
        text: title === undefined ? message : `${title}\n${message}`,
      });
    },
    cancel: record("cancel"),
    spinner: () => ({
      start: record("spinner:start"),
      stop: record("spinner:stop"),
      message: record("spinner:message"),
    }),
    log: {
      info: record("info"),
      warn: record("warn"),
      error: record("error"),
      success: record("success"),
      step: record("step"),
      message: record("message"),
    },
  };

  return {
    ui,
    output,
    on(channel) {
      return output.filter((line) => line.channel === channel).map((line) => line.text);
    },
    said(fragment) {
      return output.some((line) => line.text.includes(fragment));
    },
  };
}
