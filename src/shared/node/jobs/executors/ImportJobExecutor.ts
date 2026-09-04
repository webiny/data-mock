import { ImportJobExecutor as Abstraction } from "./abstractions/ImportJobExecutor.js";
import { ImportEntriesService } from "~/shared/node/features/seeding/import/abstractions/ImportEntriesService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class ImportJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "import";

  public constructor(private readonly importService: ImportEntriesService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    if (!context.configJson) {
      throw new Error("Import job requires config");
    }
    const config = JSON.parse(context.configJson) as ImportEntriesService.Input;
    context.appendLog(
      `Importing entries for project ${context.projectId}, models: ${config.models.join(", ")}`,
    );

    const result = await this.importService.execute({
      ...config,
      projectId: context.projectId,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    });

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(`Imported ${result.value.imported} entries.`);
  }
}

export const ImportJobExecutor = Abstraction.createImplementation({
  implementation: ImportJobExecutorImpl,
  dependencies: [ImportEntriesService],
});
