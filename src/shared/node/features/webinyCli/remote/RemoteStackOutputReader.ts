import { WebinyCliRunner } from "../runner/abstractions/WebinyCliRunner.js";
import { parseJsonOutput } from "../runner/parseJsonOutput.js";
import { buildWebinyCommand } from "../command/webinyCommandBuilder.js";
import { RemoteStackOutputReader as Abstraction } from "./abstractions/RemoteStackOutputReader.js";
import type { GenericRecord } from "~/shared/types.js";

/**
 * Reads one app's stack output through `webiny output` instead of a checkpoint file.
 *
 * This is the fallback for a remote Pulumi backend (`s3://`, `azblob://`, `gs://`), where the state
 * lives in a bucket and the local glob finds nothing. It is strictly worse than reading the
 * checkpoint and is only used when there is no checkpoint to read:
 *
 * - There is no resource count. It exists only in the checkpoint.
 * - `deployed` cannot come from `resources`; it comes from whether the output object is empty.
 * - On v6 the answer is a cache read the CLI gives no way to bypass, and the cache is maintained
 *   only by the CLI's own deploy/destroy decorators — so anything changed outside the CLI leaves it
 *   stale indefinitely, with no way to detect it. Those rows are flagged `possiblyStale`.
 * - On a never-built v6 checkout this path builds the app workspace as a side effect, so the first
 *   remote sync of a fresh checkout is slow and writes into `.webiny/`.
 */
class RemoteStackOutputReaderImpl implements Abstraction.Interface {
  public constructor(private readonly runner: WebinyCliRunner.Interface) {}

  public async execute(input: Abstraction.Input): Promise<Abstraction.Output> {
    const argsResult = buildWebinyCommand({
      command: "output",
      versionMajor: input.versionMajor,
      app: input.app,
      env: input.env,
      variant: input.variant,
      region: input.region,
    });

    if (argsResult.isFail()) {
      return unknown(argsResult.error.message);
    }

    const runResult = await this.runner.execute({
      rootPath: input.rootPath,
      args: argsResult.value,
      awsProfile: input.awsProfile,
      awsRegion: input.region,
      signal: input.signal,
    });

    if (runResult.isFail()) {
      return unknown(runResult.error.message);
    }

    const parsed = parseJsonOutput(runResult.value.stdout);

    /**
     * Nothing parseable means the command printed something we do not understand. That is unknown,
     * never not-deployed — treating it as destroyed would blank a live environment's inventory.
     */
    if (parsed === undefined) {
      return unknown("The CLI printed no JSON output.");
    }

    /**
     * A literal `null` is what BOTH majors print for a stack that does not exist — v5 prints
     * `JSON.stringify(null)`, v6 prints a null `output`. It reads as "I could not find this", not
     * as "this is destroyed", so it is unknown too.
     */
    if (parsed === null) {
      return unknown("The CLI reported no stack for this environment.");
    }

    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return unknown("The CLI printed JSON that is not a stack output object.");
    }

    const outputs = parsed as GenericRecord<string, unknown>;

    /**
     * An existing-but-empty stack prints `{}` on both majors, which is the remote equivalent of a
     * checkpoint with no `resources` key: the stack is there and holds nothing.
     */
    const deployed = Object.keys(outputs).length > 0;

    return {
      readState: deployed ? "deployed" : "not-deployed",
      deployed,
      resourceCount: null,
      outputs,
      error: null,
      // v6's `webiny output` reads its own cache first and offers no way to skip it.
      possiblyStale: input.versionMajor === 6,
    };
  }
}

function unknown(error: string): Abstraction.Output {
  return {
    readState: "unknown",
    deployed: false,
    resourceCount: null,
    outputs: null,
    error,
    possiblyStale: false,
  };
}

export const RemoteStackOutputReader = Abstraction.createImplementation({
  implementation: RemoteStackOutputReaderImpl,
  dependencies: [WebinyCliRunner],
});
