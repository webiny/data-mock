import { JobExecutorRegistry as Abstraction } from "../abstractions/JobExecutorRegistry.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";
import { SeedJobExecutor } from "./abstractions/SeedJobExecutor.js";
import { SyncTenantsJobExecutor } from "./abstractions/SyncTenantsJobExecutor.js";
import { SyncModelsJobExecutor } from "./abstractions/SyncModelsJobExecutor.js";
import { CleanupJobExecutor } from "./abstractions/CleanupJobExecutor.js";
import { ImportJobExecutor } from "./abstractions/ImportJobExecutor.js";
import { UploadFilesJobExecutor } from "./abstractions/UploadFilesJobExecutor.js";

class JobExecutorRegistryImpl implements Abstraction.Interface {
  private readonly executors = new Map<string, JobExecutor.Interface>();

  public constructor(
    seedJobExecutor: SeedJobExecutor.Interface,
    syncTenantsJobExecutor: SyncTenantsJobExecutor.Interface,
    syncModelsJobExecutor: SyncModelsJobExecutor.Interface,
    cleanupJobExecutor: CleanupJobExecutor.Interface,
    importJobExecutor: ImportJobExecutor.Interface,
    uploadFilesJobExecutor: UploadFilesJobExecutor.Interface,
  ) {
    const all: JobExecutor.Interface[] = [
      seedJobExecutor,
      syncTenantsJobExecutor,
      syncModelsJobExecutor,
      cleanupJobExecutor,
      importJobExecutor,
      uploadFilesJobExecutor,
    ];
    for (const executor of all) {
      this.executors.set(executor.type, executor);
    }
  }

  public getExecutor(type: string): JobExecutor.Interface {
    const executor = this.executors.get(type);
    if (!executor) {
      throw new Error(`No executor for job type: ${type}`);
    }
    return executor;
  }
}

export const JobExecutorRegistry = Abstraction.createImplementation({
  implementation: JobExecutorRegistryImpl,
  dependencies: [
    SeedJobExecutor,
    SyncTenantsJobExecutor,
    SyncModelsJobExecutor,
    CleanupJobExecutor,
    ImportJobExecutor,
    UploadFilesJobExecutor,
  ],
});
