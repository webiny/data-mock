import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ISyncFileInput {
  fileKey: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
}

export interface ISyncProjectFilesRepositoryInput {
  projectId: string;
  tenant: string;
  files: ISyncFileInput[];
}

export interface ISyncProjectFilesRepository {
  execute(
    input: SyncProjectFilesRepository.Input,
  ): Promise<Result<ProjectFile[], SyncProjectFilesRepository.Error>>;
}

export const SyncProjectFilesRepository = createAbstraction<ISyncProjectFilesRepository>(
  "Files/SyncProjectFilesRepository",
);

export namespace SyncProjectFilesRepository {
  export type Interface = ISyncProjectFilesRepository;
  export type Input = ISyncProjectFilesRepositoryInput;
  export type Output = ProjectFile[];
  export type FileInput = ISyncFileInput;
  export type Error = ProjectPersistenceError;
}
