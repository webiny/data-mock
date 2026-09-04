import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectFilesRepositoryInput {
  projectId: string;
  tenant?: string;
  fileType?: string;
  limit?: number;
  offset?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
}

export interface IListProjectFilesRepositoryOutput {
  files: ProjectFile[];
  total: number;
}

export interface IListProjectFilesRepository {
  execute(
    input: ListProjectFilesRepository.Input,
  ): Promise<Result<ListProjectFilesRepository.Output, ListProjectFilesRepository.Error>>;
}

export const ListProjectFilesRepository = createAbstraction<IListProjectFilesRepository>(
  "Files/ListProjectFilesRepository",
);

export namespace ListProjectFilesRepository {
  export type Interface = IListProjectFilesRepository;
  export type Input = IListProjectFilesRepositoryInput;
  export type Output = IListProjectFilesRepositoryOutput;
  export type Error = ProjectPersistenceError;
}
