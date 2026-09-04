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
    if (!context.projectId) {
      throw new Error("Seed job requires a projectId");
    }
    const projectId = context.projectId;
    const config = JSON.parse(context.configJson) as SeedService.Input;
    context.appendLog(`Starting seed for project ${projectId}`);
    context.appendLog(
      `Models: ${config.models.map((m) => `${m.modelId}(${m.amount})`).join(", ")}`,
    );

    const result = await this.seedService.execute({
      ...config,
      projectId,
      signal: context.signal,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    });

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(
      `Completed: ${result.value.created} created, ${result.value.errors.length} errors`,
    );
    if (result.value.errors.length > 0) {
      for (const err of result.value.errors) {
        context.appendLog(`  Error (${err.modelId}): ${err.message}`);
      }
    }
  }
}

export const SeedJobExecutor = Abstraction.createImplementation({
  implementation: SeedJobExecutorImpl,
  dependencies: [SeedService],
});
