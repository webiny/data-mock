/**
 * `CI=1` and `NO_COLOR=1` already ask both CLIs for plain text, but pulumi's own progress renderer
 * and any dependency that writes directly to the tty still emit escape sequences. They would be
 * stored verbatim in the job log and rendered as mojibake in the browser.
 */
const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

/** CSI sequences (colour, cursor moves) and OSC sequences (window titles, hyperlinks). */
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]|${ESC}\\][^${BEL}]*${BEL}`, "g");

/** Also drops a trailing CR, so CRLF output does not leave one on every line. */
export function stripAnsi(value: string): string {
  return value.replace(ANSI, "").replace(/\r$/, "");
}
