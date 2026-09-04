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
    const config = JSON.parse(context.configJson) as { tenant: string; fileNames?: string[] };
    context.appendLog(`Uploading global images to project ${context.projectId}`);

    const result = await this.uploadService.execute({
      projectId: context.projectId,
      tenant: config.tenant,
      fileNames: config.fileNames,
      onProgress: (percent, label) => context.setProgress({ percent, label }),
    });

    if (result.isFail()) {
      throw new Error(result.error.message);
    }

    context.appendLog(`Uploaded ${result.value.uploaded} file(s).`);
  }
}

export const UploadFilesJobExecutor = Abstraction.createImplementation({
  implementation: UploadFilesJobExecutorImpl,
  dependencies: [UploadGlobalFilesToProjectService],
});
