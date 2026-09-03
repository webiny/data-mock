import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectModelsRepositoryInput {
  projectId: string;
}

export interface IListProjectModelsRepository {
  execute(
    input: ListProjectModelsRepository.Input,
  ): Promise<Result<ProjectModel[], ListProjectModelsRepository.Error>>;
}

export const ListProjectModelsRepository = createAbstraction<IListProjectModelsRepository>(
  "Models/ListProjectModelsRepository",
);

export namespace ListProjectModelsRepository {
  export type Interface = IListProjectModelsRepository;
  export type Input = IListProjectModelsRepositoryInput;
  export type Error = ProjectPersistenceError;
}
