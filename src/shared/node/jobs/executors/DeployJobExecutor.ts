import { DeployJobExecutor as Abstraction } from "./abstractions/DeployJobExecutor.js";
import { WebinyDeploymentService } from "~/shared/node/features/webinyCli/deployment/abstractions/WebinyDeploymentService.js";
import { parseDeploymentJobConfig } from "./deploymentJobConfig.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

/**
 * Deploys one environment, one app per child process.
 *
 * No percent is reported: pulumi emits none, so the UI shows an indeterminate bar rather than a
 * number the tool would have to invent. `JobWorker` already leaves `progress` null when
 * `setProgress` was never called.
 */
class DeployJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "deploy";

  public constructor(private readonly deploymentService: WebinyDeploymentService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    if (!context.projectId) {
      throw new Error("Deploy job requires a projectId");
    }

    const config = parseDeploymentJobConfig(context.configJson);

    const result = await this.deploymentService.execute({
      command: "deploy",
      projectId: context.projectId,
      environmentId: config.environmentId,
      apps: config.apps,
      region: config.region,
      preview: config.preview,
      onLine: context.appendLog,
      // Forwarded so cancelling the job kills the child rather than orphaning a 20-minute pulumi
      // run that keeps writing to the stack.
      signal: context.signal,
    });

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(
      result.value.preview
        ? `Previewed (nothing was changed): ${result.value.apps.join(", ") || "nothing"}.`
        : `Deployed: ${result.value.apps.join(", ") || "nothing"}.`,
    );
  }
}

export const DeployJobExecutor = Abstraction.createImplementation({
  implementation: DeployJobExecutorImpl,
  dependencies: [WebinyDeploymentService],
});
