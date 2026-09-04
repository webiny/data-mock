import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IUploadFileRepositoryInput {
  projectId: string;
  tenant: string;
  fileKey: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
}

export interface IUploadFileRepository {
  execute(
    input: UploadFileRepository.Input,
  ): Promise<Result<ProjectFile, UploadFileRepository.Error>>;
}

export const UploadFileRepository = createAbstraction<IUploadFileRepository>(
  "Files/UploadFileRepository",
);

export namespace UploadFileRepository {
  export type Interface = IUploadFileRepository;
  export type Input = IUploadFileRepositoryInput;
  export type Error = ProjectPersistenceError;
}
