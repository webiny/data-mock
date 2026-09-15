import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Result, Logger } from "@webiny/stdlib";
import { WebinyCliRunner as Abstraction } from "./abstractions/WebinyCliRunner.js";
import { ValidationError, WebinyCliError } from "~/shared/errors.js";
import { buildChildEnv } from "./buildChildEnv.js";
import { stripAnsi } from "./stripAnsi.js";

/** How long a SIGTERM'd child has to exit before it is killed outright. */
const KILL_GRACE_MS = 10_000;

/** How much of the output travels with a failure. The full log lives on the job. */
const ERROR_TAIL_LINES = 40;

/**
 * Runs the project's own `webiny` binary in the project's own folder.
 *
 * No cloning, no remote agent, no bundled CLI: each checkout pins its own version, and the command
 * surface differs between majors, so the only correct binary is the one already installed there.
 */
class WebinyCliRunnerImpl implements Abstraction.Interface {
  public constructor(private readonly logger: Logger.Interface) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const rootPath = path.resolve(input.rootPath);

    if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
      return Result.fail(new ValidationError(`"${rootPath}" is not a directory`));
    }

    const command = this.resolveCommand(rootPath, input.args);

    const env = buildChildEnv({
      parentEnv: process.env,
      awsProfile: input.awsProfile,
      awsRegion: input.awsRegion,
    });

    this.logger.info(`Running: ${command.file} ${command.args.join(" ")} (cwd: ${rootPath})`);

    return this.spawnAndCollect(command, rootPath, env, input);
  }

  /**
   * Every checkout here is Yarn Berry with `nodeLinker: node-modules`, so the binary is on disk and
   * the `yarn webiny` fallback never fires. It exists for a PnP or hoisting-free checkout, where it
   * needs corepack — which is why `HOME` and `PATH` are in the environment allow-list.
   */
  private resolveCommand(rootPath: string, args: string[]): { file: string; args: string[] } {
    const local = path.join(rootPath, "node_modules", ".bin", "webiny");

    return fs.existsSync(local)
      ? { file: local, args }
      : { file: "yarn", args: ["webiny", ...args] };
  }

  private spawnAndCollect(
    command: { file: string; args: string[] },
    cwd: string,
    env: NodeJS.ProcessEnv,
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    return new Promise((resolve) => {
      const child = spawn(command.file, command.args, { cwd, env });

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      const lines: string[] = [];

      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;

      const emit = (line: string): void => {
        lines.push(line);
        input.onLine?.(line);
      };

      const stdoutReader = createLineReader(emit);
      const stderrReader = createLineReader(emit);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      child.stdout.on("data", (chunk: string) => {
        stdoutChunks.push(chunk);
        stdoutReader.push(chunk);
      });

      child.stderr.on("data", (chunk: string) => {
        stderrChunks.push(chunk);
        stderrReader.push(chunk);
      });

      /**
       * SIGTERM first so pulumi can unwind, then SIGKILL. A pulumi run killed outright can leave
       * its stack lock behind, which blocks the next deploy of that stack.
       */
      const onAbort = (): void => {
        child.kill("SIGTERM");
        killTimer = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
      };

      if (input.signal) {
        if (input.signal.aborted) {
          onAbort();
        } else {
          input.signal.addEventListener("abort", onAbort, { once: true });
        }
      }

      const cleanup = (): void => {
        if (killTimer !== undefined) {
          clearTimeout(killTimer);
        }
        input.signal?.removeEventListener("abort", onAbort);
      };

      const settle = (result: Result<Abstraction.Output, Abstraction.Error>): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };

      child.on("error", (error: Error) => {
        stdoutReader.flush();
        stderrReader.flush();
        settle(
          Result.fail(
            new WebinyCliError(
              `Could not run "${command.file}": ${error.message}`,
              -1,
              lines.join("\n"),
            ),
          ),
        );
      });

      child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
        stdoutReader.flush();
        stderrReader.flush();

        const stdout = stdoutChunks.join("");
        const stderr = stderrChunks.join("");
        const exitCode = code ?? -1;

        if (code === 0) {
          settle(Result.ok({ stdout, stderr, exitCode }));
          return;
        }

        const reason =
          signal === null ? `exited with code ${exitCode}` : `was terminated by ${signal}`;

        settle(
          Result.fail(
            new WebinyCliError(
              `webiny ${input.args.join(" ")} ${reason}`,
              exitCode,
              lines.slice(-ERROR_TAIL_LINES).join("\n"),
            ),
          ),
        );
      });
    });
  }
}

/**
 * Splits a byte stream into lines. A chunk boundary can fall mid-line, so the tail is held until
 * the next chunk arrives and flushed when the stream ends — otherwise the last line of output,
 * which is usually the error, is lost.
 */
function createLineReader(onLine: (line: string) => void): {
  push: (chunk: string) => void;
  flush: () => void;
} {
  let buffer = "";

  return {
    push(chunk: string): void {
      buffer += chunk;
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        onLine(stripAnsi(part));
      }
    },
    flush(): void {
      if (buffer !== "") {
        onLine(stripAnsi(buffer));
        buffer = "";
      }
    },
  };
}

export const WebinyCliRunner = Abstraction.createImplementation({
  implementation: WebinyCliRunnerImpl,
  dependencies: [Logger],
});
