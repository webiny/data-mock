import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IRemoveProjectRepositoryInput {
  id: string;
}

export interface IRemoveProjectRepository {
  execute(
    input: RemoveProjectRepository.Input,
  ): Promise<Result<void, RemoveProjectRepository.Error>>;
}

export const RemoveProjectRepository = createAbstraction<IRemoveProjectRepository>(
  "Projects/RemoveProjectRepository",
);

export namespace RemoveProjectRepository {
  export type Interface = IRemoveProjectRepository;
  export type Input = IRemoveProjectRepositoryInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
