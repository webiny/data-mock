import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IDeleteProjectFileRepositoryInput {
  id: string;
}

export interface IDeleteProjectFileRepository {
  execute(
    input: DeleteProjectFileRepository.Input,
  ): Promise<Result<void, DeleteProjectFileRepository.Error>>;
}

export const DeleteProjectFileRepository = createAbstraction<IDeleteProjectFileRepository>(
  "Files/DeleteProjectFileRepository",
);

export namespace DeleteProjectFileRepository {
  export type Interface = IDeleteProjectFileRepository;
  export type Input = IDeleteProjectFileRepositoryInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
