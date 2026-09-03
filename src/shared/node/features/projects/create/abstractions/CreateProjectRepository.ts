import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ICreateProjectRepositoryInput {
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant: string;
}

export interface ICreateProjectRepository {
  execute(
    input: CreateProjectRepository.Input,
  ): Promise<Result<Project, CreateProjectRepository.Error>>;
}

export const CreateProjectRepository = createAbstraction<ICreateProjectRepository>(
  "Projects/CreateProjectRepository",
);

export namespace CreateProjectRepository {
  export type Interface = ICreateProjectRepository;
  export type Input = ICreateProjectRepositoryInput;
  export type Error = ProjectPersistenceError;
}
