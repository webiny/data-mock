import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { UpdateProjectRepository } from "~/shared/node/features/projects/update/abstractions/UpdateProjectRepository.js";
import { ListEnvironmentsRepository } from "~/shared/node/features/environments/list/abstractions/ListEnvironmentsRepository.js";
import { CreateEnvironmentRepository } from "~/shared/node/features/environments/create/abstractions/CreateEnvironmentRepository.js";
import { WebinyProjectDetector } from "../detect/abstractions/WebinyProjectDetector.js";
import { PulumiCheckpointReader } from "../checkpoint/abstractions/PulumiCheckpointReader.js";
import { RefreshEnvironmentStacksService } from "./refresh/abstractions/RefreshEnvironmentStacksService.js";
import { RemoteStackOutputReader } from "../remote/abstractions/RemoteStackOutputReader.js";
import { SyncSystemService as Abstraction } from "./abstractions/SyncSystemService.js";
import { ValidationError } from "~/shared/errors.js";
import { getStackName } from "~/shared/environments/index.js";
import type { Project, SyncStatus } from "~/shared/types.js";

class SyncSystemServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly updateProjectRepository: UpdateProjectRepository.Interface,
    private readonly listEnvironmentsRepository: ListEnvironmentsRepository.Interface,
    private readonly createEnvironmentRepository: CreateEnvironmentRepository.Interface,
    private readonly refreshEnvironmentStacksService: RefreshEnvironmentStacksService.Interface,
    private readonly remoteStackOutputReader: RemoteStackOutputReader.Interface,
    private readonly detector: WebinyProjectDetector.Interface,
    private readonly checkpointReader: PulumiCheckpointReader.Interface,
    private readonly logger: Logger.Interface,
  ) {}

  public async execute(
    input: Abstraction.Input,
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const onProgress = input.onProgress;
    const messages: string[] = [];

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

    onProgress?.(10, "Detecting project...");

    const detectResult = await this.detector.execute({ rootPath: project.rootPath });
    if (detectResult.isFail()) {
      return Result.fail(detectResult.error);
    }
    const detected = detectResult.value;

    if (!detected.isWebinyProject) {
      return Result.fail(new ValidationError(`"${project.rootPath}" is not a Webiny project.`));
    }

    const stamped = await this.updateProjectRepository.execute({
      id: project.id,
      webinyVersion: detected.webinyVersion,
      versionSource: detected.versionSource,
      versionMajor: detected.versionMajor,
      pulumiBackend: detected.pulumiBackend,
    });

    /**
     * The version write is not incidental: the operation registry and the CLI argument builder both
     * read it. A sync that could not store it and carried on would report success while leaving the
     * project on whatever version it had before.
     */
    if (stamped.isFail()) {
      return Result.fail(stamped.error);
    }

    /**
     * A remote backend keeps its state in a bucket, so there are no checkpoints to read and nothing
     * to discover — the glob finds nothing whether the project is deployed or not. Environments
     * must be added manually; what CAN be done is read their output through the CLI.
     */
    if (detected.remoteBackend) {
      return this.syncRemote(project, detected, messages, onProgress);
    }

    onProgress?.(25, "Discovering environments...");

    const discovered = this.checkpointReader.listEnvironments(project.rootPath);

    /**
     * Archived environments are listed too. They still hold the (project, env, variant) slot in the
     * unique index, so discovery has to see them or it will try to insert a duplicate beside one
     * and fail. They are excluded from the sync itself: archiving is a deliberate "stop tracking
     * this stack", and rediscovery must not undo it.
     */
    const existingResult = await this.listEnvironmentsRepository.execute({
      projectId: project.id,
      includeArchived: true,
    });
    if (existingResult.isFail()) {
      return Result.fail(existingResult.error);
    }
    const existing = existingResult.value;

    // Manually added environments are preserved: a remote backend or a not-yet-deployed stack has
    // no checkpoint, and discovery must not delete what it cannot see.
    const toSync = existing.filter((environment) => environment.archivedAt === null);
    for (const candidate of discovered) {
      const already = existing.find(
        (environment) =>
          environment.env === candidate.env && environment.variant === candidate.variant,
      );
      if (already) {
        if (already.archivedAt !== null) {
          messages.push(
            `Environment "${getStackName(candidate)}" is archived; skipped. Restore it to sync it again.`,
          );
        }
        continue;
      }
      const created = await this.createEnvironmentRepository.execute({
        projectId: project.id,
        env: candidate.env,
        variant: candidate.variant,
      });
      if (created.isOk()) {
        toSync.push(created.value);
        messages.push(`Discovered environment "${getStackName(candidate)}".`);
      } else {
        // Said out loud rather than dropped: the stack is on disk, and silently not tracking it
        // looks identical to it not being there.
        messages.push(
          `Found "${getStackName(candidate)}" on disk but could not store it: ${created.error.message}`,
        );
      }
    }

    let stacksRead = 0;
    let stacksUnknown = 0;
    let environmentsDeployed = 0;
    const totalUnits = Math.max(1, toSync.length * detected.apps.length);
    let completed = 0;

    for (const environment of toSync) {
      const summary = await this.refreshEnvironmentStacksService.execute({
        rootPath: project.rootPath,
        environment,
        apps: detected.apps,
        onApp: () => {
          completed += 1;
          onProgress?.(
            25 + Math.round((completed / totalUnits) * 70),
            `Reading ${getStackName(environment)}...`,
          );
        },
      });

      stacksRead += summary.read;
      stacksUnknown += summary.unknown;
      if (summary.deployed) {
        environmentsDeployed += 1;
      }
    }

    const status: SyncStatus = stacksUnknown > 0 ? "partial" : "success";
    await this.stampProject(project.id, status);

    onProgress?.(100, "Synced");

    this.logger.info(
      `Synced "${project.name}": ${toSync.length} environment(s), ${environmentsDeployed} deployed.`,
    );

    return Result.ok({
      status,
      versionMajor: detected.versionMajor,
      webinyVersion: detected.webinyVersion,
      environmentsFound: toSync.length,
      environmentsDeployed,
      stacksRead,
      stacksUnknown,
      messages,
    });
  }

  /**
   * The remote-backend path. Strictly worse than reading checkpoints, and used only because there
   * are none:
   *
   * - no resource counts — they exist only in the checkpoint, which is in the bucket;
   * - no discovery — manually added environments are all there is to sync;
   * - on v6 the answer comes from a cache the CLI gives no way to bypass, so the whole sync is
   *   stamped `stale-possible` rather than presented as fresh.
   */
  private async syncRemote(
    project: Project,
    detected: WebinyProjectDetector.Output,
    messages: string[],
    onProgress: Abstraction.Input["onProgress"],
  ): Promise<Result<Abstraction.Output, Abstraction.Error>> {
    const rootPath = project.rootPath;
    const versionMajor = detected.versionMajor;
    if (rootPath === null || versionMajor === null) {
      return Result.fail(new ValidationError("A remote sync needs a local checkout to run in."));
    }

    messages.push(
      `Backend is remote (${detected.pulumiBackend}); stack state is not on disk. ` +
        "Reading it through the Webiny CLI instead. Environments must be added manually.",
    );

    const existingResult = await this.listEnvironmentsRepository.execute({
      projectId: project.id,
      includeArchived: true,
    });
    if (existingResult.isFail()) {
      return Result.fail(existingResult.error);
    }

    const toSync = existingResult.value.filter((environment) => environment.archivedAt === null);

    if (toSync.length === 0) {
      messages.push("No environments are registered for this project yet. Add one manually.");
      await this.stampProject(project.id, "partial");
      return Result.ok({
        status: "partial",
        versionMajor,
        webinyVersion: detected.webinyVersion,
        environmentsFound: 0,
        environmentsDeployed: 0,
        stacksRead: 0,
        stacksUnknown: 0,
        messages,
      });
    }

    let stacksRead = 0;
    let stacksUnknown = 0;
    let environmentsDeployed = 0;
    let anyStale = false;
    const totalUnits = Math.max(1, toSync.length * detected.apps.length);
    let completed = 0;

    for (const environment of toSync) {
      const summary = await this.refreshEnvironmentStacksService.execute({
        rootPath,
        environment,
        apps: detected.apps,
        onApp: () => {
          completed += 1;
          onProgress?.(
            25 + Math.round((completed / totalUnits) * 70),
            `Reading ${getStackName(environment)}...`,
          );
        },
        readStack: async (app) => {
          const result = await this.remoteStackOutputReader.execute({
            rootPath,
            versionMajor,
            app,
            env: environment.env,
            variant: environment.variant,
            region: environment.region ?? project.awsRegion,
            awsProfile: project.awsProfile,
          });

          if (result.possiblyStale) {
            anyStale = true;
          }
          if (result.error !== null) {
            messages.push(`${getStackName(environment)}/${app}: ${result.error}`);
          }

          return result;
        },
      });

      stacksRead += summary.read;
      stacksUnknown += summary.unknown;
      if (summary.deployed) {
        environmentsDeployed += 1;
      }
    }

    if (anyStale) {
      messages.push(
        "Webiny v6 answers `webiny output` from a cache it offers no way to bypass, so anything " +
          "changed outside the CLI may not be reflected here.",
      );
    }

    /**
     * `stale-possible` outranks `partial`. A read that succeeded but may be out of date is a
     * different problem from one that failed, and collapsing the two would hide it.
     */
    const status: SyncStatus = anyStale
      ? "stale-possible"
      : stacksUnknown > 0
        ? "partial"
        : "success";

    await this.stampProject(project.id, status);
    onProgress?.(100, "Synced");

    return Result.ok({
      status,
      versionMajor,
      webinyVersion: detected.webinyVersion,
      environmentsFound: toSync.length,
      environmentsDeployed,
      stacksRead,
      stacksUnknown,
      messages,
    });
  }

  private async stampProject(projectId: string, status: SyncStatus): Promise<void> {
    await this.updateProjectRepository.execute({
      id: projectId,
      lastSyncedAt: Date.now(),
      lastSyncStatus: status,
    });
  }
}

export const SyncSystemService = Abstraction.createImplementation({
  implementation: SyncSystemServiceImpl,
  dependencies: [
    GetProjectRepository,
    UpdateProjectRepository,
    ListEnvironmentsRepository,
    CreateEnvironmentRepository,
    RefreshEnvironmentStacksService,
    RemoteStackOutputReader,
    WebinyProjectDetector,
    PulumiCheckpointReader,
    Logger,
  ],
});
