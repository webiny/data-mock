import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IUpdateProjectRepositoryInput {
  id: string;
  name?: string;
  apiUrl?: string;
  apiToken?: string;
  tenant?: string;
  webinyVersion?: string;
}

export interface IUpdateProjectRepository {
  execute(
    input: UpdateProjectRepository.Input,
  ): Promise<Result<Project, UpdateProjectRepository.Error>>;
}

export const UpdateProjectRepository = createAbstraction<IUpdateProjectRepository>(
  "Projects/UpdateProjectRepository",
);

export namespace UpdateProjectRepository {
  export type Interface = IUpdateProjectRepository;
  export type Input = IUpdateProjectRepositoryInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
