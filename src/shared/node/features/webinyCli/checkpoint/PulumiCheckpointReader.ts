import fs from "node:fs";
import path from "node:path";
import { getStackName, splitStackName } from "~/shared/environments/index.js";
import { PulumiCheckpointReader as Abstraction } from "./abstractions/PulumiCheckpointReader.js";
import type { GenericRecord } from "~/shared/types.js";

/** Pulumi's own marker for a secret value; the plaintext is not recoverable from the file. */
const SECRET_SIGNATURE = "4dabf18193072939515e22adb298388d";

const STACK_RESOURCE_TYPE = "pulumi:pulumi:Stack";

/**
 * Reads Pulumi's local file backend directly instead of shelling out to `webiny output`.
 *
 * Verified equivalent: the checkpoint's Stack outputs are byte-identical to
 * `pulumi stack output --json` across both Webiny majors. Going through the CLI would instead mean
 * a cache that cannot be bypassed on v6 (GetAppStackOutput takes no options), a stream that mixes
 * JSON with other output on v5, and a process spawn per app per environment.
 *
 * Writes are atomic — pulumi's fileblob driver writes a temp file and renames — so a read never
 * sees a partial file.
 */
class PulumiCheckpointReaderImpl implements Abstraction.Interface {
  public read(input: Abstraction.Input): Abstraction.Output {
    const stackName = getStackName({ env: input.env, variant: input.variant });
    const file = this.findStackFile(input.rootPath, input.app, stackName);

    if (file === null) {
      return this.unknown(`No stack file for ${input.app}/${stackName}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (error) {
      return this.unknown(`Could not parse ${file}: ${String(error)}`);
    }

    if (parsed === null || typeof parsed !== "object") {
      return this.unknown(`Unexpected checkpoint shape in ${file}`);
    }

    const checkpoint = (parsed as GenericRecord<string, unknown>)["checkpoint"];
    const latest =
      checkpoint && typeof checkpoint === "object"
        ? (checkpoint as GenericRecord<string, unknown>)["latest"]
        : undefined;
    const resources =
      latest && typeof latest === "object"
        ? (latest as GenericRecord<string, unknown>)["resources"]
        : undefined;

    /**
     * A destroyed stack keeps its file but drops the `resources` key entirely. That is a real
     * "not deployed", distinct from a file we could not read — and distinct from what both CLI
     * versions report, which is `{}` rather than null.
     */
    if (!Array.isArray(resources) || resources.length === 0) {
      return {
        readState: "not-deployed",
        deployed: false,
        resourceCount: 0,
        outputs: null,
        error: null,
      };
    }

    const stackResource = resources.find(
      (resource): resource is GenericRecord<string, unknown> =>
        resource !== null &&
        typeof resource === "object" &&
        (resource as GenericRecord<string, unknown>)["type"] === STACK_RESOURCE_TYPE,
    );

    const rawOutputs = stackResource?.["outputs"];
    const outputs =
      rawOutputs && typeof rawOutputs === "object" && !Array.isArray(rawOutputs)
        ? this.maskSecrets(rawOutputs as GenericRecord<string, unknown>)
        : null;

    return {
      readState: "deployed",
      deployed: true,
      resourceCount: resources.length,
      outputs,
      error: null,
    };
  }

  public listEnvironments(rootPath: string): Abstraction.DiscoveredEnvironment[] {
    // Core only: an environment exists once core is deployed, which is what Webiny's own
    // ListDeployedEnvironmentsService relies on.
    const found = new Set<string>();

    for (const dir of this.stackDirsFor(rootPath, "core")) {
      if (!fs.existsSync(dir)) {
        continue;
      }
      for (const entry of fs.readdirSync(dir)) {
        if (entry.endsWith(".json")) {
          found.add(entry.slice(0, -".json".length));
        }
      }
    }

    return [...found].sort().map((stackName) => splitStackName(stackName));
  }

  /**
   * The backend directory is derived from the app's relative path, and the stack directory from
   * the generated Pulumi project name — neither is guaranteed to equal the app name, so both are
   * searched rather than assumed.
   */
  private stackDirsFor(rootPath: string, app: string): string[] {
    const appBackend = path.join(rootPath, ".pulumi", "apps", app, ".pulumi", "stacks");
    if (!fs.existsSync(appBackend)) {
      return [];
    }
    return fs
      .readdirSync(appBackend, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(appBackend, entry.name));
  }

  private findStackFile(rootPath: string, app: string, stackName: string): string | null {
    for (const dir of this.stackDirsFor(rootPath, app)) {
      const candidate = path.join(dir, `${stackName}.json`);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /** Secret outputs are ciphertext in the file; surface that they exist without pretending to read them. */
  private maskSecrets(outputs: GenericRecord<string, unknown>): GenericRecord<string, unknown> {
    const masked: GenericRecord<string, unknown> = {};
    for (const [key, value] of Object.entries(outputs)) {
      const isSecret =
        value !== null && typeof value === "object" && SECRET_SIGNATURE in (value as object);
      masked[key] = isSecret ? "(secret)" : value;
    }
    return masked;
  }

  private unknown(error: string): Abstraction.Output {
    return { readState: "unknown", deployed: false, resourceCount: null, outputs: null, error };
  }
}

export const PulumiCheckpointReader = Abstraction.createImplementation({
  implementation: PulumiCheckpointReaderImpl,
  dependencies: [],
});
