import { Result } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { ListEnvironmentsRepository } from "~/shared/node/features/environments/list/abstractions/ListEnvironmentsRepository.js";
import { ListStacksRepository } from "~/shared/node/features/environments/stacks/abstractions/ListStacksRepository.js";
import { WebinyProjectDetector } from "../../detect/abstractions/WebinyProjectDetector.js";
import { PulumiCheckpointReader } from "../../checkpoint/abstractions/PulumiCheckpointReader.js";
import { RemoteStackOutputReader } from "../../remote/abstractions/RemoteStackOutputReader.js";
import { SyncPreviewService as Abstraction } from "./abstractions/SyncPreviewService.js";
import { ValidationError } from "~/shared/errors.js";
import { getStackName } from "~/shared/environments/index.js";
import { deriveEnvironmentState, mergeStackRead } from "~/shared/stackOutput/stackState.js";
import type { IStackRead, IStoredStackState } from "~/shared/stackOutput/stackState.js";
import type {
  SyncEnvironmentChangeResponse,
  SyncFieldChangeResponse,
  SyncStackChangeResponse,
} from "~/shared/responses/sync.js";
import type { Project, ProjectEnvironment } from "~/shared/types.js";

/**
 * Reads everything a sync reads and writes none of it, so the change can be shown before it is
 * stored.
 *
 * It deliberately does not share a code path with `SyncSystemService`: the sync's value is that it
 * writes, and a `dryRun` flag threaded through its writes is exactly where a preview stops matching
 * what it previews. What the two DO share is how a read becomes a stored row and how an environment
 * is derived from its stacks — `mergeStackRead` and `deriveEnvironmentState` — which is where the
 * two could disagree in a way the user would notice.
 */
class SyncPreviewServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly listEnvironmentsRepository: ListEnvironmentsRepository.Interface,
    private readonly listStacksRepository: ListStacksRepository.Interface,
    private readonly detector: WebinyProjectDetector.Interface,
    private readonly checkpointReader: PulumiCheckpointReader.Interface,
    private readonly remoteStackOutputReader: RemoteStackOutputReader.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const projectResult = await this.getProjectRepository.execute({ id: input.projectId });
    if (projectResult.isFail()) {
      return Result.fail(projectResult.error);
    }
    const project = projectResult.value;

    if (project.rootPath === null) {
      return Result.fail(
        new ValidationError(
          `Project "${project.name}" has no local checkout, so there is nothing to sync.`,
        ),
      );
    }

    const detectResult = await this.detector.execute({ rootPath: project.rootPath });
    if (detectResult.isFail()) {
      return Result.fail(detectResult.error);
    }
    const detected = detectResult.value;

    if (!detected.isWebinyProject) {
      return Result.fail(new ValidationError(`"${project.rootPath}" is not a Webiny project.`));
    }

    const messages: string[] = [];
    const projectFields = this.diffProject(project, detected);

    const existingResult = await this.listEnvironmentsRepository.execute({
      projectId: project.id,
      includeArchived: true,
    });
    if (existingResult.isFail()) {
      return Result.fail(existingResult.error);
    }
    const existing = existingResult.value;
    const active = existing.filter((environment) => environment.archivedAt === null);

    const environments: SyncEnvironmentChangeResponse[] = [];

    if (detected.remoteBackend) {
      messages.push(
        `Backend is remote (${detected.pulumiBackend}); stack state is not on disk and is read ` +
          "through the Webiny CLI. No environments are discovered — they must be added manually.",
      );
      if (active.length === 0) {
        messages.push("No environments are registered for this project yet. Add one manually.");
      }
    } else {
      environments.push(...this.diffDiscovered(project.rootPath, detected.apps, existing));
    }

    for (const environment of active) {
      environments.push(await this.diffEnvironment(project, detected, environment));
    }

    /**
     * A skipped environment is not a change: it is archived, and the sync leaves it exactly as it
     * is. Counting it would offer an "apply" that writes nothing.
     */
    const hasChanges =
      projectFields.length > 0 ||
      environments.some(
        (environment) => environment.change === "added" || environment.change === "updated",
      );

    return Result.ok({
      projectId: project.id,
      projectName: project.name,
      backend: detected.remoteBackend ? "remote" : "local",
      hasChanges,
      project: projectFields,
      environments,
      messages,
    });
  }

  private diffProject(
    project: Project,
    detected: WebinyProjectDetector.Output,
  ): SyncFieldChangeResponse[] {
    return compact([
      change("webinyVersion", "Webiny version", project.webinyVersion, detected.webinyVersion),
      change("versionSource", "Version read from", project.versionSource, detected.versionSource),
      change("versionMajor", "Major version", project.versionMajor, detected.versionMajor),
      change("pulumiBackend", "Pulumi backend", project.pulumiBackend, detected.pulumiBackend),
    ]);
  }

  /**
   * Environments found on disk that are not stored yet.
   *
   * An archived environment still holds its (project, env, variant) slot, so it is listed as
   * skipped rather than offered as new: rediscovery must not undo a deliberate archive.
   */
  private diffDiscovered(
    rootPath: string,
    apps: string[],
    existing: ProjectEnvironment[],
  ): SyncEnvironmentChangeResponse[] {
    const discovered = this.checkpointReader.listEnvironments(rootPath);
    const changes: SyncEnvironmentChangeResponse[] = [];

    for (const candidate of discovered) {
      const already = existing.find(
        (environment) =>
          environment.env === candidate.env && environment.variant === candidate.variant,
      );

      if (already !== undefined) {
        if (already.archivedAt !== null) {
          changes.push({
            stackName: getStackName(candidate),
            env: candidate.env,
            variant: candidate.variant,
            change: "skipped",
            note: "Archived. Restore it to sync it again.",
            fields: [],
            stacks: [],
          });
        }
        continue;
      }

      const stacks = apps.map((app) =>
        this.diffStack(app, null, this.readCheckpoint(rootPath, app, candidate)),
      );

      changes.push({
        stackName: getStackName(candidate),
        env: candidate.env,
        variant: candidate.variant,
        change: "added",
        note: "Found on disk, not stored yet.",
        fields: [],
        stacks,
      });
    }

    return changes;
  }

  private async diffEnvironment(
    project: Project,
    detected: WebinyProjectDetector.Output,
    environment: ProjectEnvironment,
  ): Promise<SyncEnvironmentChangeResponse> {
    const storedResult = await this.listStacksRepository.execute({
      environmentId: environment.id,
    });
    const stored: IStoredStackState[] = (storedResult.isOk() ? storedResult.value : []).map(
      (stack) => ({
        app: stack.app,
        deployed: stack.deployed,
        resourceCount: stack.resourceCount,
        stackOutput: stack.stackOutput,
        readState: stack.readState,
      }),
    );

    const merged = [...stored];
    const stacks: SyncStackChangeResponse[] = [];

    for (const app of detected.apps) {
      const current = stored.find((stack) => stack.app === app) ?? null;
      const read = await this.readStack(project, detected, environment, app);
      const incoming = mergeStackRead(app, current, read);

      const index = merged.findIndex((stack) => stack.app === app);
      if (index === -1) {
        merged.push(incoming);
      } else {
        merged[index] = incoming;
      }

      stacks.push(this.diffStack(app, current, read));
    }

    const derived = deriveEnvironmentState(merged);

    const fields = compact([
      change("deployed", "Deployed", environment.deployed, derived.deployed),
      change("apiUrl", "API URL", environment.apiUrl, derived.apiUrl),
      change("adminUrl", "Admin URL", environment.adminUrl, derived.adminUrl),
      // The sync only ever sets a region it could read; it never clears a stored one.
      derived.region === null
        ? null
        : change("region", "Region", environment.region, derived.region),
    ]);

    /**
     * Judged on the fields, not on the labels. A stack that was unreadable before and is unreadable
     * now carries the "unreadable" label with nothing to write behind it, and calling that an
     * update would show a change on every sync of a project whose apps are not all deployed.
     */
    const changed = fields.length > 0 || stacks.some((stack) => stack.fields.length > 0);

    return {
      stackName: getStackName(environment),
      env: environment.env,
      variant: environment.variant,
      change: changed ? "updated" : "unchanged",
      note: null,
      fields,
      stacks,
    };
  }

  private diffStack(
    app: string,
    current: IStoredStackState | null,
    read: IStackRead,
  ): SyncStackChangeResponse {
    const incoming = mergeStackRead(app, current, read);

    /**
     * An unreadable stack is its own outcome, never "not deployed". It leaves the stored output
     * alone, so the only thing a sync would change here is the read state.
     */
    if (read.readState === "unknown") {
      return {
        app,
        change: "unreadable",
        fields: compact([change("readState", "Read state", current?.readState ?? null, "unknown")]),
      };
    }

    const fields = compact([
      change("deployed", "Deployed", current?.deployed ?? null, incoming.deployed),
      change("readState", "Read state", current?.readState ?? null, incoming.readState),
      change("resourceCount", "Resources", current?.resourceCount ?? null, incoming.resourceCount),
      outputChange(current?.stackOutput ?? null, incoming.stackOutput),
    ]);

    return {
      app,
      change: current === null ? "added" : fields.length > 0 ? "updated" : "unchanged",
      fields,
    };
  }

  private async readStack(
    project: Project,
    detected: WebinyProjectDetector.Output,
    environment: ProjectEnvironment,
    app: string,
  ): Promise<IStackRead> {
    if (!detected.remoteBackend) {
      return this.readCheckpoint(project.rootPath as string, app, environment);
    }

    return this.remoteStackOutputReader.execute({
      rootPath: project.rootPath as string,
      versionMajor: detected.versionMajor as number,
      app,
      env: environment.env,
      variant: environment.variant,
      region: environment.region ?? project.awsRegion,
      awsProfile: project.awsProfile,
    });
  }

  private readCheckpoint(
    rootPath: string,
    app: string,
    environment: { env: string; variant: string },
  ): IStackRead {
    return this.checkpointReader.read({
      rootPath,
      app,
      env: environment.env,
      variant: environment.variant,
    });
  }
}

/** A field entry, or null when the value is not changing. */
function change(
  field: string,
  label: string,
  current: unknown,
  incoming: unknown,
): SyncFieldChangeResponse | null {
  const currentText = render(current);
  const incomingText = render(incoming);

  return currentText === incomingText
    ? null
    : { field, label, current: currentText, incoming: incomingText };
}

/**
 * Stack output is compared whole and reported as a count. Showing every key would bury the facts
 * that decide whether to store the sync — deployed, resources, URLs — under a wall of Pulumi keys.
 */
function outputChange(
  current: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null,
): SyncFieldChangeResponse | null {
  if (JSON.stringify(current) === JSON.stringify(incoming)) {
    return null;
  }

  return {
    field: "stackOutput",
    label: "Stack output",
    current: describeOutput(current),
    incoming: describeOutput(incoming),
  };
}

function describeOutput(output: Record<string, unknown> | null): string {
  if (output === null) {
    return "none";
  }
  const count = Object.keys(output).length;
  return count === 1 ? "1 key" : `${count} keys`;
}

function render(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return String(value);
}

function compact(values: Array<SyncFieldChangeResponse | null>): SyncFieldChangeResponse[] {
  return values.filter((value): value is SyncFieldChangeResponse => value !== null);
}

export const SyncPreviewService = Abstraction.createImplementation({
  implementation: SyncPreviewServiceImpl,
  dependencies: [
    GetProjectRepository,
    ListEnvironmentsRepository,
    ListStacksRepository,
    WebinyProjectDetector,
    PulumiCheckpointReader,
    RemoteStackOutputReader,
  ],
});
