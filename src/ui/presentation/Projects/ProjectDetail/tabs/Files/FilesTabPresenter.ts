import { makeAutoObservable, runInAction } from "mobx";
import { FilesGateway } from "~/ui/features/files/abstractions/FilesGateway.js";
import { FilesRepository } from "~/ui/features/files/abstractions/FilesRepository.js";
import { LocalFilesGateway } from "~/ui/features/localFiles/abstractions/LocalFilesGateway.js";
import { LocalFilesRepository } from "~/ui/features/localFiles/abstractions/LocalFilesRepository.js";
import type { ILocalFileVM } from "~/ui/features/localFiles/abstractions/LocalFilesGateway.js";
import { NotificationService } from "~/ui/features/notifications/abstractions/NotificationService.js";
import { EventBridge } from "~/ui/infrastructure/events/abstractions/EventBridge.js";
import { ActionConfirmation } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";
import type { WSJobStatus } from "~/shared/websocket/types.js";
import { TERMINAL_JOB_STATUSES } from "~/shared/jobs/constants.js";
import { getJobTypeDatasets } from "~/shared/jobs/descriptors.js";
import type { ProjectFile } from "~/shared/types.js";
import { tabContextKey } from "../abstractions/ProjectDetailTabContext.js";
import type { ProjectDetailTabContext } from "../abstractions/ProjectDetailTabContext.js";
import { FilesTabPresenter as Abstraction } from "./abstractions/FilesTabPresenter.js";
import type { IFilesTabVM, IMergedFileVM } from "./abstractions/FilesTabPresenter.js";

/** The dataset this tab owns, as the job descriptors name it. */
const DATASET = "files";

class FilesTabPresenterImpl implements Abstraction.Interface {
  private _context: ProjectDetailTabContext | null = null;
  private _loadedKey: string | null = null;
  private _isLoading = false;
  private _isUploadingGlobal = false;
  private _isPullingFiles = false;
  private readonly actionConfirmation = new ActionConfirmation();
  private readonly disposeJobSubscription: () => void;

  public constructor(
    private readonly filesGateway: FilesGateway.Interface,
    private readonly filesRepository: FilesRepository.Interface,
    private readonly localFilesGateway: LocalFilesGateway.Interface,
    private readonly localFilesRepository: LocalFilesRepository.Interface,
    private readonly notifications: NotificationService.Interface,
    eventBridge: EventBridge.Interface,
  ) {
    makeAutoObservable(this);
    this.disposeJobSubscription = eventBridge.on("job:status", this.handleJobStatus);
  }

  public get vm(): IFilesTabVM {
    const context = this._context;
    const environmentId = context?.ref?.environmentId ?? null;
    const files = environmentId ? this.filesRepository.getFilesByEnvironmentId(environmentId) : [];
    const localFiles = context?.projectId ? this.localFilesRepository.files : [];

    return {
      files: files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        tenant: file.tenant,
        uploadedAt: file.uploadedAt,
      })),
      mergedFiles: this.buildMergedFiles(files, localFiles),
      isLoading: this._isLoading,
      isUploadingGlobal: this._isUploadingGlobal,
      isPullingFiles: this._isPullingFiles,
      confirmation: this.actionConfirmation.vm,
    };
  }

  public activate = async (context: ProjectDetailTabContext): Promise<void> => {
    runInAction(() => {
      this._context = context;
    });
    if (context.ref === null) {
      return;
    }
    if (this._loadedKey === tabContextKey(context) || this._isLoading) {
      return;
    }
    await this.read(context);
  };

  public dispose = (): void => {
    this.disposeJobSubscription();
  };

  public deleteFile = async (fileId: string): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    const result = await this.filesGateway.remove(ref, fileId);
    if (result.isOk()) {
      runInAction(() => {
        this.filesRepository.removeFile(fileId);
      });
      this.notifications.success("File deleted.");
    } else {
      this.notifications.error("Failed to delete file.");
    }
  };

  public uploadFilesToProject = async (files: File[]): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    const tenant = this._context?.tenant ?? "root";
    const failures: string[] = [];

    for (const file of files) {
      try {
        const fileContent = await readFileAsBase64(file);
        const result = await this.filesGateway.upload(ref, {
          tenant,
          fileName: file.name,
          fileContent,
          fileType: file.type,
        });
        if (result.isFail()) {
          failures.push(`${file.name}: ${result.error.message}`);
        }
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    runInAction(() => {
      if (failures.length > 0) {
        this.notifications.error(`Some files failed to upload: ${failures.join("; ")}`);
      } else {
        this.notifications.success("Files uploaded.");
      }
    });

    await this.reread();
  };

  public uploadAllGlobalImages = async (): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    const tenant = this._context?.tenant ?? "root";
    runInAction(() => {
      this._isUploadingGlobal = true;
    });
    try {
      const result = await this.localFilesGateway.uploadGlobalToProject(ref, { tenant });
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Upload job started.");
        } else {
          this.notifications.error(`Failed to upload global images: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isUploadingGlobal = false;
      });
    }
  };

  public uploadSelectedGlobalImages = async (fileNames: string[]): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null || fileNames.length === 0) {
      return;
    }
    const tenant = this._context?.tenant ?? "root";
    runInAction(() => {
      this._isUploadingGlobal = true;
    });
    try {
      const result = await this.localFilesGateway.uploadGlobalToProject(ref, {
        tenant,
        fileNames,
      });
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success("Upload job started.");
        } else {
          this.notifications.error(`Failed to upload selected images: ${result.error.message}`);
        }
      });
    } finally {
      runInAction(() => {
        this._isUploadingGlobal = false;
      });
    }
  };

  public pullFiles = (): void => {
    const context = this._context;
    if (context === null || context.ref === null) {
      return;
    }
    const stackName = context.envName ?? "";
    const tenant = context.tenant;

    this.actionConfirmation.request({
      title: "Pull files",
      message: `Download the File Manager contents of tenant "${tenant}" on ${stackName} into this tool?`,
      confirmLabel: "Pull files",
      run: this.runPullFiles,
    });
  };

  public confirmAction = async (): Promise<void> => {
    await this.actionConfirmation.confirm();
  };

  public cancelAction = (): void => {
    this.actionConfirmation.cancel();
  };

  private runPullFiles = async (): Promise<void> => {
    const ref = this._context?.ref ?? null;
    if (ref === null) {
      return;
    }
    const tenant = this._context?.tenant ?? "root";
    runInAction(() => {
      this._isPullingFiles = true;
    });
    try {
      const result = await this.filesGateway.pullFiles(ref, tenant);
      runInAction(() => {
        if (result.isOk()) {
          this.notifications.success(`Pulled ${result.value.synced} file(s) from File Manager.`);
        } else {
          this.notifications.error(`Failed to pull files: ${result.error.message}`);
        }
      });
      await this.reread();
    } finally {
      runInAction(() => {
        this._isPullingFiles = false;
      });
    }
  };

  /**
   * A failed read is never marked loaded, so the next activation asks again rather than leaving
   * the tab blank for the rest of the session.
   */
  private read = async (context: ProjectDetailTabContext): Promise<void> => {
    const ref = context.ref;
    if (ref === null) {
      return;
    }
    runInAction(() => {
      this._isLoading = true;
    });
    try {
      const [filesResult, localFilesResult] = await Promise.all([
        this.filesGateway.list(ref),
        this.localFilesGateway.list(),
      ]);
      if (filesResult.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${filesResult.error.message}`);
        return;
      }
      if (localFilesResult.isFail()) {
        this.notifications.error(`Could not load ${DATASET}: ${localFilesResult.error.message}`);
        return;
      }
      runInAction(() => {
        this.filesRepository.setFiles(filesResult.value);
        this.localFilesRepository.setFiles(localFilesResult.value);
        this._loadedKey = tabContextKey(context);
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  /** Forces the next read to hit the network again, then does it right away. */
  private reread = async (): Promise<void> => {
    const context = this._context;
    if (context === null) {
      return;
    }
    runInAction(() => {
      this._loadedKey = null;
    });
    await this.read(context);
  };

  /**
   * A job that writes this tab's dataset makes what is on screen stale. The descriptor table is
   * the single source for which job type writes what; a local copy is what drifted before.
   */
  private handleJobStatus = (event: WSJobStatus): void => {
    const context = this._context;
    if (context === null || event.projectId !== context.projectId) {
      return;
    }
    if (!TERMINAL_JOB_STATUSES.has(event.status)) {
      return;
    }
    if (!getJobTypeDatasets(event.type).includes(DATASET)) {
      return;
    }
    void this.reread();
  };

  private buildMergedFiles = (
    projectFiles: ProjectFile[],
    localFiles: ILocalFileVM[],
  ): IMergedFileVM[] => {
    const projectFileNames = new Set(projectFiles.map((file) => file.fileName));

    const projectMerged: IMergedFileVM[] = projectFiles.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      source: "project",
      thumbnailUrl: file.fileUrl,
      badges: [{ label: "project", color: "blue" }],
    }));

    const globalMerged: IMergedFileVM[] = localFiles
      .filter((file) => !projectFileNames.has(file.fileName))
      .map((file) => ({
        id: file.fileName,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        source: "global",
        thumbnailUrl: `/api/files/local/${encodeURIComponent(file.fileName)}/content`,
        badges: [{ label: "global", color: "gray" }],
      }));

    return [...projectMerged, ...globalMerged];
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Failed to read file "${file.name}"`));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error(`Failed to read file "${file.name}"`));
    };
    reader.readAsDataURL(file);
  });
}

export const FilesTabPresenter = Abstraction.createImplementation({
  implementation: FilesTabPresenterImpl,
  dependencies: [
    FilesGateway,
    FilesRepository,
    LocalFilesGateway,
    LocalFilesRepository,
    NotificationService,
    EventBridge,
  ],
});
