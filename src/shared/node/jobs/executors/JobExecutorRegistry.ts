import { JobExecutorRegistry as Abstraction } from "../abstractions/JobExecutorRegistry.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";
import { SeedJobExecutor } from "./abstractions/SeedJobExecutor.js";
import { SyncTenantsJobExecutor } from "./abstractions/SyncTenantsJobExecutor.js";
import { SyncModelsJobExecutor } from "./abstractions/SyncModelsJobExecutor.js";
import { CleanupJobExecutor } from "./abstractions/CleanupJobExecutor.js";
import { ImportJobExecutor } from "./abstractions/ImportJobExecutor.js";
import { UploadFilesJobExecutor } from "./abstractions/UploadFilesJobExecutor.js";
import { PullPicsumJobExecutor } from "./abstractions/PullPicsumJobExecutor.js";
import { SyncSystemJobExecutor } from "./abstractions/SyncSystemJobExecutor.js";
import { SyncPreviewJobExecutor } from "./abstractions/SyncPreviewJobExecutor.js";
import { DeployJobExecutor } from "./abstractions/DeployJobExecutor.js";
import { DestroyJobExecutor } from "./abstractions/DestroyJobExecutor.js";

class JobExecutorRegistryImpl implements Abstraction.Interface {
  private readonly executors = new Map<string, JobExecutor.Interface>();

  public constructor(
    seedJobExecutor: SeedJobExecutor.Interface,
    syncTenantsJobExecutor: SyncTenantsJobExecutor.Interface,
    syncModelsJobExecutor: SyncModelsJobExecutor.Interface,
    cleanupJobExecutor: CleanupJobExecutor.Interface,
    importJobExecutor: ImportJobExecutor.Interface,
    uploadFilesJobExecutor: UploadFilesJobExecutor.Interface,
    pullPicsumJobExecutor: PullPicsumJobExecutor.Interface,
    syncSystemJobExecutor: SyncSystemJobExecutor.Interface,
    syncPreviewJobExecutor: SyncPreviewJobExecutor.Interface,
    deployJobExecutor: DeployJobExecutor.Interface,
    destroyJobExecutor: DestroyJobExecutor.Interface,
  ) {
    const all: JobExecutor.Interface[] = [
      seedJobExecutor,
      syncTenantsJobExecutor,
      syncModelsJobExecutor,
      cleanupJobExecutor,
      importJobExecutor,
      uploadFilesJobExecutor,
      pullPicsumJobExecutor,
      syncSystemJobExecutor,
      syncPreviewJobExecutor,
      deployJobExecutor,
      destroyJobExecutor,
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
    PullPicsumJobExecutor,
    SyncSystemJobExecutor,
    SyncPreviewJobExecutor,
    DeployJobExecutor,
    DestroyJobExecutor,
  ],
});
