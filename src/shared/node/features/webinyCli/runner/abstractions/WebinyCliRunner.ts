import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ValidationError } from "~/shared/errors.js";
import type { WebinyCliError } from "~/shared/errors.js";

export interface IWebinyCliRunInput {
  /** Absolute path to the project checkout. The child runs here. */
  rootPath: string;
  /** Arguments after the binary, e.g. `["deploy", "api", "--env=dev"]`. */
  args: string[];
  awsProfile?: string | null | undefined;
  awsRegion?: string | null | undefined;
  /** Called once per output line, stdout and stderr merged in arrival order, ANSI stripped. */
  onLine?: ((line: string) => void) | undefined;
  /** Aborting sends SIGTERM to the child's process group, then SIGKILL after a grace period. */
  signal?: AbortSignal | undefined;
  /** The job this run belongs to. Recorded alongside the child process, for diagnostics. */
  jobId?: string | null | undefined;
}

export interface IWebinyCliRunOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface IWebinyCliRunner {
  execute(
    input: WebinyCliRunner.Input,
  ): Promise<Result<IWebinyCliRunOutput, WebinyCliRunner.Error>>;
}

export const WebinyCliRunner = createAbstraction<IWebinyCliRunner>("WebinyCli/WebinyCliRunner");

export namespace WebinyCliRunner {
  export type Interface = IWebinyCliRunner;
  export type Input = IWebinyCliRunInput;
  export type Output = IWebinyCliRunOutput;
  export type Error = ValidationError | WebinyCliError;
}
