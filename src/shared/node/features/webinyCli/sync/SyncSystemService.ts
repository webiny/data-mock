import { Result, Logger } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { UpdateProjectRepository } from "~/shared/node/features/projects/update/abstractions/UpdateProjectRepository.js";
import { ListEnvironmentsRepository } from "~/shared/node/features/environments/list/abstractions/ListEnvironmentsRepository.js";
import { CreateEnvironmentRepository } from "~/shared/node/features/environments/create/abstractions/CreateEnvironmentRepository.js";
import { UpdateEnvironmentRepository } from "~/shared/node/features/environments/update/abstractions/UpdateEnvironmentRepository.js";
import { UpsertStackRepository } from "~/shared/node/features/environments/stacks/abstractions/UpsertStackRepository.js";
import { WebinyProjectDetector } from "../detect/abstractions/WebinyProjectDetector.js";
import { PulumiCheckpointReader } from "../checkpoint/abstractions/PulumiCheckpointReader.js";
import { SyncSystemService as Abstraction } from "./abstractions/SyncSystemService.js";
import { readAdminUrl, readApiUrl, readRegion } from "~/shared/stackOutput/stackOutputKeyMap.js";
import { ValidationError } from "~/shared/errors.js";
import { getStackName } from "~/shared/environments/index.js";
import type { ProjectEnvironment, SyncStatus } from "~/shared/types.js";

class SyncSystemServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly updateProjectRepository: UpdateProjectRepository.Interface,
    private readonly listEnvironmentsRepository: ListEnvironmentsRepository.Interface,
    private readonly createEnvironmentRepository: CreateEnvironmentRepository.Interface,
    private readonly updateEnvironmentRepository: UpdateEnvironmentRepository.Interface,
    private readonly upsertStackRepository: UpsertStackRepository.Interface,
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

    await this.updateProjectRepository.execute({
      id: project.id,
      webinyVersion: detected.webinyVersion,
      versionSource: detected.versionSource,
      versionMajor: detected.versionMajor,
      pulumiBackend: detected.pulumiBackend,
    });

    /**
     * A remote backend keeps its state in a bucket, so there are no checkpoints to read. Say so
     * rather than reporting every environment as destroyed.
     */
    if (detected.remoteBackend) {
      messages.push(
        `Backend is remote (${detected.pulumiBackend}); stack state is not on disk. ` +
          "Environments must be added manually.",
      );
      await this.stampProject(project.id, "partial");
      return Result.ok({
        status: "partial",
        versionMajor: detected.versionMajor,
        webinyVersion: detected.webinyVersion,
        environmentsFound: 0,
        environmentsDeployed: 0,
        stacksRead: 0,
        stacksUnknown: 0,
        messages,
      });
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
      }
    }

    let stacksRead = 0;
    let stacksUnknown = 0;
    let environmentsDeployed = 0;
    const totalUnits = Math.max(1, toSync.length * detected.apps.length);
    let completed = 0;

    for (const environment of toSync) {
      const summary = await this.syncEnvironment(
        project.rootPath,
        environment,
        detected.apps,
        () => {
          completed += 1;
          onProgress?.(
            25 + Math.round((completed / totalUnits) * 70),
            `Reading ${getStackName(environment)}...`,
          );
        },
      );

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

  private async syncEnvironment(
    rootPath: string,
    environment: ProjectEnvironment,
    apps: string[],
    onApp: () => void,
  ): Promise<{ read: number; unknown: number; deployed: boolean }> {
    let read = 0;
    let unknown = 0;
    let anyDeployed = false;
    let apiUrl: string | null = null;
    let adminUrl: string | null = null;
    let region: string | null = null;

    for (const app of apps) {
      const result = this.checkpointReader.read({
        rootPath,
        app,
        env: environment.env,
        variant: environment.variant,
      });

      await this.upsertStackRepository.execute({
        environmentId: environment.id,
        app,
        readState: result.readState,
        deployed: result.deployed,
        resourceCount: result.resourceCount,
        stackOutput: result.outputs,
      });

      if (result.readState === "unknown") {
        unknown += 1;
      } else {
        read += 1;
      }

      if (result.deployed) {
        anyDeployed = true;
        if (app === "api") {
          apiUrl = readApiUrl(result.outputs);
          region = readRegion(result.outputs) ?? region;
        }
        if (app === "admin") {
          adminUrl = readAdminUrl(result.outputs);
        }
        if (app === "core" && region === null) {
          region = readRegion(result.outputs);
        }
      }

      onApp();
    }

    /**
     * apiUrl and adminUrl are per-app facts: an environment with core deployed but no api app is
     * deployed, yet has no API to talk to. They are only overwritten when their app was readable,
     * so an unknown read leaves the last good value in place.
     */
    await this.updateEnvironmentRepository.execute({
      id: environment.id,
      deployed: anyDeployed,
      ...(apiUrl !== null || anyDeployed ? { apiUrl } : {}),
      ...(adminUrl !== null || anyDeployed ? { adminUrl } : {}),
      ...(region !== null ? { region } : {}),
      lastSyncedAt: Date.now(),
    });

    return { read, unknown, deployed: anyDeployed };
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
    UpdateEnvironmentRepository,
    UpsertStackRepository,
    WebinyProjectDetector,
    PulumiCheckpointReader,
    Logger,
  ],
});
