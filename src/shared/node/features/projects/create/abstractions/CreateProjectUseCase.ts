import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";

export interface ICreateProjectInput {
  name: string;
  apiUrl: string;
  apiToken: string;
  tenant?: string;
  webinyVersion?: string;
}

export interface ICreateProjectUseCase {
  execute(input: CreateProjectUseCase.Input): Promise<Result<Project, CreateProjectUseCase.Error>>;
}

export const CreateProjectUseCase = createAbstraction<ICreateProjectUseCase>(
  "Projects/CreateProjectUseCase",
);

export namespace CreateProjectUseCase {
  export type Interface = ICreateProjectUseCase;
  export type Input = ICreateProjectInput;
  export type Error = ValidationError | ProjectPersistenceError;
}
