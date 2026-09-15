import { Result } from "@webiny/stdlib";
import { GetProjectRepository } from "~/shared/node/features/projects/get/abstractions/GetProjectRepository.js";
import { GetEnvironmentRepository } from "~/shared/node/features/environments/get/abstractions/GetEnvironmentRepository.js";
import { WebinyProjectDetector } from "../detect/abstractions/WebinyProjectDetector.js";
import { WebinyCliRunner } from "../runner/abstractions/WebinyCliRunner.js";
import { RefreshEnvironmentStacksService } from "../sync/refresh/abstractions/RefreshEnvironmentStacksService.js";
import { WebinyDeploymentService as Abstraction } from "./abstractions/WebinyDeploymentService.js";
import {
  buildWebinyCommand,
  orderAppsForDeploy,
  orderAppsForDestroy,
} from "../command/webinyCommandBuilder.js";
import { ValidationError } from "~/shared/errors.js";
import { getStackName } from "~/shared/environments/index.js";
import type { ProjectEnvironment } from "~/shared/types.js";

/**
 * Runs `webiny deploy` or `webiny destroy` for one environment, one app per child process.
 *
 * One app per invocation is not a style choice. On v5, omitting the app positional trips the gate
 * that then demands `--confirm-destroy-env`; on v6 it destroys admin, api and core in sequence with
 * no confirmation of any kind. Passing exactly the apps the user confirmed is what keeps a destroy
 * scoped to what they asked for.
 */
class WebinyDeploymentServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly getProjectRepository: GetProjectRepository.Interface,
    private readonly getEnvironmentRepository: GetEnvironmentRepository.Interface,
    private readonly detector: WebinyProjectDetector.Interface,
    private readonly runner: WebinyCliRunner.Interface,
    private readonly refreshEnvironmentStacksService: RefreshEnvironmentStacksService.Interface,
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
          `Project "${project.name}" has no local checkout, so it cannot be ${input.command}ed.`,
        ),
      );
    }

    const environmentResult = await this.getEnvironmentRepository.execute({
      id: input.environmentId,
    });
    if (environmentResult.isFail()) {
      return Result.fail(environmentResult.error);
    }
    const environment = environmentResult.value;

    if (environment.projectId !== project.id) {
      return Result.fail(
        new ValidationError(`Environment "${environment.id}" does not belong to this project.`),
      );
    }

    if (environment.archivedAt !== null) {
      return Result.fail(
        new ValidationError(
          `Environment "${getStackName(environment)}" is archived. Restore it before ${
            input.command === "deploy" ? "deploying" : "destroying"
          }.`,
        ),
      );
    }

    const detectResult = await this.detector.execute({ rootPath: project.rootPath });
    if (detectResult.isFail()) {
      return Result.fail(detectResult.error);
    }
    const detected = detectResult.value;

    if (!detected.isWebinyProject || detected.versionMajor === null) {
      return Result.fail(new ValidationError(`"${project.rootPath}" is not a Webiny project.`));
    }

    const appsResult = this.resolveApps(input, detected.apps);
    if (appsResult.isFail()) {
      return Result.fail(appsResult.error);
    }
    const apps = appsResult.value;

    // The environment's own region unless this run overrides it; the project's default otherwise.
    const region = input.region ?? environment.region ?? project.awsRegion;

    const completed: string[] = [];

    for (const app of apps) {
      if (input.signal?.aborted === true) {
        break;
      }

      const argsResult = buildWebinyCommand({
        command: input.command,
        versionMajor: detected.versionMajor,
        app,
        env: environment.env,
        variant: environment.variant,
        region,
        preview: input.preview === true,
      });

      if (argsResult.isFail()) {
        return Result.fail(argsResult.error);
      }

      input.onLine?.(`--- webiny ${argsResult.value.join(" ")}`);

      const runResult = await this.runner.execute({
        rootPath: project.rootPath,
        args: argsResult.value,
        awsProfile: project.awsProfile,
        awsRegion: region,
        onLine: input.onLine,
        signal: input.signal,
      });

      if (runResult.isFail()) {
        /**
         * Refresh before returning. A failed deploy is rarely a no-op — pulumi may have created
         * some resources before it stopped — so leaving the stored state untouched would report
         * infrastructure that exists as absent. A preview is the exception: it changed nothing,
         * so there is nothing to re-read.
         */
        if (input.preview !== true) {
          await this.refresh(project.rootPath, environment, detected.apps);
        }
        return Result.fail(runResult.error);
      }

      completed.push(app);
    }

    if (input.preview === true) {
      return Result.ok({ apps: completed, preview: true, refreshed: false });
    }

    await this.refresh(project.rootPath, environment, detected.apps);

    return Result.ok({ apps: completed, preview: false, refreshed: true });
  }

  /**
   * An empty app list means every deployable app for this version, in dependency order: api needs
   * core's tables and bucket, admin needs api's URL. Destroy runs the reverse.
   *
   * An app the version does not know about is rejected rather than passed through — v6's
   * `GetAppService` throws `Invalid app name`, and v5 needs both an `appAliases` entry and the
   * folder on disk, so an unchecked name fails deep inside the CLI with a worse message.
   */
  private resolveApps(
    input: Abstraction.Input,
    deployable: string[],
  ): Result<string[], ValidationError> {
    const requested = input.apps ?? [];

    if (requested.length === 0) {
      return Result.ok(
        input.command === "deploy"
          ? orderAppsForDeploy(deployable)
          : orderAppsForDestroy(deployable),
      );
    }

    const unknown = requested.filter((app) => !deployable.includes(app));
    if (unknown.length > 0) {
      return Result.fail(
        new ValidationError(
          `Unknown app(s) for this project: ${unknown.join(", ")}. Deployable: ${deployable.join(", ")}.`,
        ),
      );
    }

    return Result.ok(
      input.command === "deploy" ? orderAppsForDeploy(requested) : orderAppsForDestroy(requested),
    );
  }

  /**
   * Every app is re-read, not just the ones this run touched: the environment row is derived from
   * the whole set, and reading back the untouched stacks is what keeps a partial deploy from
   * blanking a URL it never went near.
   */
  private async refresh(
    rootPath: string,
    environment: ProjectEnvironment,
    apps: string[],
  ): Promise<void> {
    await this.refreshEnvironmentStacksService.execute({ rootPath, environment, apps });
  }
}

export const WebinyDeploymentService = Abstraction.createImplementation({
  implementation: WebinyDeploymentServiceImpl,
  dependencies: [
    GetProjectRepository,
    GetEnvironmentRepository,
    WebinyProjectDetector,
    WebinyCliRunner,
    RefreshEnvironmentStacksService,
  ],
});
