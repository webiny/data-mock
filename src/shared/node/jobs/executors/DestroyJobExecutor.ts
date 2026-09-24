import { DestroyJobExecutor as Abstraction } from "./abstractions/DestroyJobExecutor.js";
import { WebinyDeploymentService } from "~/shared/node/features/webinyCli/deployment/abstractions/WebinyDeploymentService.js";
import { parseDeploymentJobConfig } from "./deploymentJobConfig.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

/**
 * Destroys apps in one environment, one app per child process and in reverse dependency order.
 *
 * The environment row itself survives: destroying its infrastructure is not the same as forgetting
 * it, and its seed entries, sync logs and job history stay addressable afterwards.
 */
class DestroyJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "destroy";

  public constructor(private readonly deploymentService: WebinyDeploymentService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    if (!context.projectId) {
      throw new Error("Destroy job requires a projectId");
    }

    const config = parseDeploymentJobConfig(context.configJson);

    const result = await this.deploymentService.execute({
      command: "destroy",
      projectId: context.projectId,
      environmentId: config.environmentId,
      apps: config.apps,
      region: config.region,
      onLine: context.appendLog,
      signal: context.signal,
      jobId: context.jobId,
    });

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(`Destroyed: ${result.value.apps.join(", ") || "nothing"}.`);
  }
}

export const DestroyJobExecutor = Abstraction.createImplementation({
  implementation: DestroyJobExecutorImpl,
  dependencies: [WebinyDeploymentService],
});
