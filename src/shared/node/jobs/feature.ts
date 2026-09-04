import { createFeature } from "@webiny/stdlib";
import { JobWorker } from "./JobWorker.js";
import { JobExecutionContextFactory } from "./JobExecutionContextFactory.js";
import { JobExecutorRegistry } from "./executors/JobExecutorRegistry.js";
import { SeedJobExecutor } from "./executors/SeedJobExecutor.js";
import { SyncTenantsJobExecutor } from "./executors/SyncTenantsJobExecutor.js";
import { SyncModelsJobExecutor } from "./executors/SyncModelsJobExecutor.js";
import { CleanupJobExecutor } from "./executors/CleanupJobExecutor.js";
import { ImportJobExecutor } from "./executors/ImportJobExecutor.js";
import { UploadFilesJobExecutor } from "./executors/UploadFilesJobExecutor.js";
import { PullPicsumJobExecutor } from "./executors/PullPicsumJobExecutor.js";

export const JobsFeature = createFeature({
  name: "Jobs/JobsFeature",
  register(container) {
    container.register(SeedJobExecutor).inSingletonScope();
    container.register(SyncTenantsJobExecutor).inSingletonScope();
    container.register(SyncModelsJobExecutor).inSingletonScope();
    container.register(CleanupJobExecutor).inSingletonScope();
    container.register(ImportJobExecutor).inSingletonScope();
    container.register(UploadFilesJobExecutor).inSingletonScope();
    container.register(PullPicsumJobExecutor).inSingletonScope();
    container.register(JobExecutorRegistry).inSingletonScope();
    container.register(JobExecutionContextFactory).inSingletonScope();
    container.register(JobWorker).inSingletonScope();
  },
});
