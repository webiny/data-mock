import { createAbstraction } from "@webiny/stdlib";
import type { ProjectDetailTabContext } from "../../abstractions/ProjectDetailTabContext.js";
import type { IActionConfirmationVM } from "~/ui/presentation/shared/confirmation/ActionConfirmation.js";

export interface IFileVM {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  tenant: string;
  uploadedAt: number;
}

export interface IFileBadgeVM {
  label: string;
  color: string;
}

export interface IMergedFileVM {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  source: "project" | "global";
  thumbnailUrl: string;
  badges: IFileBadgeVM[];
}

export interface IFilesTabVM {
  files: IFileVM[];
  mergedFiles: IMergedFileVM[];
  isLoading: boolean;
  isUploadingGlobal: boolean;
  isPullingFiles: boolean;
  /** The one dialog standing in front of every action that starts a job. */
  confirmation: IActionConfirmationVM;
}

export interface IFilesTabPresenter {
  readonly vm: IFilesTabVM;
  /**
   * Reads the tab's data for the context it is mounted on, once. Called by the component when it
   * mounts and again whenever the context changes — the project detail shell resolves an
   * environment asynchronously, so the first call on a fresh page usually has none.
   */
  activate(context: ProjectDetailTabContext): Promise<void>;
  dispose(): void;
  deleteFile(fileId: string): Promise<void>;
  uploadFilesToProject(files: File[]): Promise<void>;
  uploadAllGlobalImages(): Promise<void>;
  uploadSelectedGlobalImages(fileNames: string[]): Promise<void>;
  /** Opens the confirmation dialog; the pull itself runs from `confirmAction`. */
  pullFiles(): void;
  /** Runs the action the open confirmation describes. */
  confirmAction(): Promise<void>;
  cancelAction(): void;
}

export const FilesTabPresenter = createAbstraction<IFilesTabPresenter>("Ui/FilesTabPresenter");

export namespace FilesTabPresenter {
  export type Interface = IFilesTabPresenter;
  export type VM = IFilesTabVM;
}
