import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectFilesRepositoryInput {
  projectId: string;
  tenant?: string;
  fileType?: string;
}

export interface IListProjectFilesRepository {
  execute(
    input: ListProjectFilesRepository.Input,
  ): Promise<Result<ProjectFile[], ListProjectFilesRepository.Error>>;
}

export const ListProjectFilesRepository = createAbstraction<IListProjectFilesRepository>(
  "Files/ListProjectFilesRepository",
);

export namespace ListProjectFilesRepository {
  export type Interface = IListProjectFilesRepository;
  export type Input = IListProjectFilesRepositoryInput;
  export type Error = ProjectPersistenceError;
}
