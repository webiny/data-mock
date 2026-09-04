import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel } from "~/shared/types.js";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IGetProjectModelRepositoryInput {
  projectId: string;
  modelId: string;
}

export interface IGetProjectModelRepository {
  execute(
    input: GetProjectModelRepository.Input,
  ): Promise<Result<ProjectModel, GetProjectModelRepository.Error>>;
}

export const GetProjectModelRepository = createAbstraction<IGetProjectModelRepository>(
  "Models/GetProjectModelRepository",
);

export namespace GetProjectModelRepository {
  export type Interface = IGetProjectModelRepository;
  export type Input = IGetProjectModelRepositoryInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
