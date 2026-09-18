import { SeedJobExecutor as Abstraction } from "./abstractions/SeedJobExecutor.js";
import { SeedService } from "~/shared/node/features/seeding/seed/abstractions/SeedService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class SeedJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "seed";

  public constructor(private readonly seedService: SeedService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    if (!context.configJson) {
      throw new Error("Seed job requires config");
    }
    if (!context.environmentId) {
      throw new Error("Seed job requires an environmentId");
    }
    const environmentId = context.environmentId;
    const config = JSON.parse(context.configJson) as SeedService.Input;
    context.appendLog(`Starting seed for project ${environmentId}`);
    context.appendLog(
      `Models: ${config.models.map((model) => `${model.modelId}(${model.amount})`).join(", ")}`,
    );

    const result = await this.seedService.execute({
      ...config,
      environmentId,
      signal: context.signal,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    });

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    // "Completed" over a run the user stopped is the job log disagreeing with the job's own status.
    context.appendLog(
      `${result.value.cancelled ? "Cancelled" : "Completed"}: ${result.value.created} created, ${result.value.errors.length} errors`,
    );
    if (result.value.errors.length > 0) {
      for (const error of result.value.errors) {
        context.appendLog(`  Error (${error.modelId}): ${error.message}`);
      }
    }
  }
}

export const SeedJobExecutor = Abstraction.createImplementation({
  implementation: SeedJobExecutorImpl,
  dependencies: [SeedService],
});
