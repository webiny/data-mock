import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IGetProjectRepositoryInput {
  id: string;
}

export interface IGetProjectRepository {
  execute(input: GetProjectRepository.Input): Promise<Result<Project, GetProjectRepository.Error>>;
}

export const GetProjectRepository = createAbstraction<IGetProjectRepository>(
  "Projects/GetProjectRepository",
);

export namespace GetProjectRepository {
  export type Interface = IGetProjectRepository;
  export type Input = IGetProjectRepositoryInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
