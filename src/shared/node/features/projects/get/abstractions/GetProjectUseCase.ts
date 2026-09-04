import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IGetProjectInput {
  id: string;
}

export interface IGetProjectUseCase {
  execute(input: GetProjectUseCase.Input): Promise<Result<Project, GetProjectUseCase.Error>>;
}

export const GetProjectUseCase = createAbstraction<IGetProjectUseCase>(
  "Projects/GetProjectUseCase",
);

export namespace GetProjectUseCase {
  export type Interface = IGetProjectUseCase;
  export type Input = IGetProjectInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
