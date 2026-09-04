import { createAbstraction } from "@webiny/stdlib";

export interface IFileManagerBadgeVM {
  label: string;
  color: string;
}

export interface IFileManagerFileVM {
  fileName: string;
  fileType: string;
  fileSize: number;
  isImage: boolean;
  thumbnailUrl: string;
  badges: IFileManagerBadgeVM[];
}

export interface IFileManagerVM {
  files: IFileManagerFileVM[];
  isLoading: boolean;
  isPullingPicsum: boolean;
  picsumCount: number;
  error: string | null;
  previewFile: IFileManagerFileVM | null;
}

export interface IFileManagerPresenter {
  readonly vm: IFileManagerVM;
  load(): Promise<void>;
  pullPicsum(): Promise<void>;
  setPicsumCount(count: number): void;
  deleteFile(fileName: string): Promise<void>;
  uploadFiles(files: File[]): Promise<void>;
  openPreview(file: IFileManagerFileVM): void;
  closePreview(): void;
  dispose(): void;
}

export const FileManagerPresenter =
  createAbstraction<IFileManagerPresenter>("Ui/FileManagerPresenter");

export namespace FileManagerPresenter {
  export type Interface = IFileManagerPresenter;
  export type VM = IFileManagerVM;
  export type FileVM = IFileManagerFileVM;
  export type BadgeVM = IFileManagerBadgeVM;
}
