import { UploadFilesJobExecutor as Abstraction } from "./abstractions/UploadFilesJobExecutor.js";
import { UploadGlobalFilesToProjectService } from "~/shared/node/features/files/pool/abstractions/UploadGlobalFilesToProjectService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

class UploadFilesJobExecutorImpl implements Abstraction.Interface {
  public readonly type = "upload-files";

  public constructor(private readonly uploadService: UploadGlobalFilesToProjectService.Interface) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    if (!context.configJson) {
      throw new Error("Upload files job requires config");
    }
    if (!context.environmentId) {
      throw new Error("Upload files job requires an environmentId");
    }
    const environmentId = context.environmentId;
    const config = JSON.parse(context.configJson) as { tenant: string; fileNames?: string[] };
    context.appendLog(`Uploading global images to environment ${environmentId}`);

    const result = await this.uploadService.execute({
      environmentId,
      tenant: config.tenant,
      fileNames: config.fileNames,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    });

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    const { uploaded, failures } = result.value;

    // Named on the job, not only in the server log. The job log is what the user reads, and a bare
    // success count over a run that mostly failed reads as a clean run.
    for (const failure of failures) {
      context.appendLog(`  Failed "${failure.fileName}": ${failure.error}`);
    }

    context.appendLog(
      failures.length === 0
        ? `Uploaded ${uploaded} file(s).`
        : `Uploaded ${uploaded} file(s), ${failures.length} failed.`,
    );
  }
}

export const UploadFilesJobExecutor = Abstraction.createImplementation({
  implementation: UploadFilesJobExecutorImpl,
  dependencies: [UploadGlobalFilesToProjectService],
});
