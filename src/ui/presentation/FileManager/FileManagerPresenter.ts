import { makeAutoObservable, runInAction } from "mobx";
import { LocalFilesGateway } from "~/ui/features/localFiles/abstractions/LocalFilesGateway.js";
import { LocalFilesRepository } from "~/ui/features/localFiles/abstractions/LocalFilesRepository.js";
import type { ILocalFileVM } from "~/ui/features/localFiles/abstractions/LocalFilesGateway.js";
import { FileManagerPresenter as Abstraction } from "./abstractions/FileManagerPresenter.js";
import type {
  IFileManagerVM,
  IFileManagerFileVM,
  IFileManagerBadgeVM,
} from "./abstractions/FileManagerPresenter.js";

const DEFAULT_PICSUM_COUNT = 10;

class FileManagerPresenterImpl implements Abstraction.Interface {
  private _isLoading = false;
  private _isPullingPicsum = false;
  private _picsumCount = DEFAULT_PICSUM_COUNT;
  private _error: string | null = null;
  private _previewFileName: string | null = null;

  public constructor(
    private readonly localFilesGateway: LocalFilesGateway.Interface,
    private readonly localFilesRepository: LocalFilesRepository.Interface,
  ) {
    makeAutoObservable(this);
  }

  public get vm(): IFileManagerVM {
    const files = this.localFilesRepository.files.map((file) => this.toFileVM(file));

    return {
      files,
      isLoading: this._isLoading,
      isPullingPicsum: this._isPullingPicsum,
      picsumCount: this._picsumCount,
      error: this._error,
      previewFile: files.find((file) => file.fileName === this._previewFileName) ?? null,
    };
  }

  private toFileVM(file: ILocalFileVM): IFileManagerFileVM {
    const badges: IFileManagerBadgeVM[] =
      file.uploadedToProjects.length > 0
        ? file.uploadedToProjects.map((project) => ({
            label: project.projectName,
            color: "blue",
          }))
        : [{ label: "global", color: "gray" }];

    return {
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      isImage: file.fileType.startsWith("image/"),
      thumbnailUrl: `/api/files/local/${encodeURIComponent(file.fileName)}/content`,
      badges,
    };
  }

  public load = async (): Promise<void> => {
    this._isLoading = true;
    this._error = null;
    try {
      const result = await this.localFilesGateway.list();
      runInAction(() => {
        if (result.isFail()) {
          this._error = result.error.message;
          return;
        }
        this.localFilesRepository.setFiles(result.value);
      });
    } finally {
      runInAction(() => {
        this._isLoading = false;
      });
    }
  };

  public pullPicsum = async (): Promise<void> => {
    this._isPullingPicsum = true;
    this._error = null;
    try {
      const result = await this.localFilesGateway.pullPicsum({ count: this._picsumCount });
      if (result.isFail()) {
        runInAction(() => {
          this._error = result.error.message;
        });
        return;
      }
      await this.load();
    } finally {
      runInAction(() => {
        this._isPullingPicsum = false;
      });
    }
  };

  public setPicsumCount = (count: number): void => {
    this._picsumCount = count;
  };

  public deleteFile = async (fileName: string): Promise<void> => {
    this._error = null;
    const result = await this.localFilesGateway.remove(fileName);
    runInAction(() => {
      if (result.isFail()) {
        this._error = result.error.message;
        return;
      }
      this.localFilesRepository.removeFile(fileName);
      if (this._previewFileName === fileName) {
        this._previewFileName = null;
      }
    });
  };

  public uploadFiles = async (files: File[]): Promise<void> => {
    this._error = null;
    const failures: string[] = [];

    for (const file of files) {
      try {
        const fileContent = await readFileAsBase64(file);
        const result = await this.localFilesGateway.upload({
          fileName: file.name,
          fileContent,
        });
        runInAction(() => {
          if (result.isFail()) {
            failures.push(`${file.name}: ${result.error.message}`);
            return;
          }
          this.localFilesRepository.addFile(result.value);
        });
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (failures.length > 0) {
      runInAction(() => {
        this._error = failures.join("; ");
      });
    }
  };

  public openPreview = (file: IFileManagerFileVM): void => {
    this._previewFileName = file.fileName;
  };

  public closePreview = (): void => {
    this._previewFileName = null;
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

export const FileManagerPresenter = Abstraction.createImplementation({
  implementation: FileManagerPresenterImpl,
  dependencies: [LocalFilesGateway, LocalFilesRepository],
});
