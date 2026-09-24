import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project, ProjectEnvironment } from "~/shared/types.js";
import type { ProjectPersistenceError, ValidationError } from "~/shared/errors.js";

export interface ICreateProjectInput {
  name: string;
  /** Absolute path to a Webiny checkout. Omit for a remote-only project. */
  rootPath?: string | undefined;
  operationsVersion?: string | undefined;
  awsProfile?: string | undefined;
  awsRegion?: string | undefined;
  /** Seeds the project's first environment. */
  env?: string | undefined;
  apiUrl?: string | undefined;
  apiToken?: string | undefined;
  tenant?: string | undefined;
}

/**
 * A project is never useful alone — every seedable thing hangs off an environment — so creation
 * always produces both, and the environment is returned alongside the project.
 */
export interface ICreateProjectOutput {
  project: Project;
  environment: ProjectEnvironment;
}

export interface ICreateProjectUseCase {
  execute(
    input: CreateProjectUseCase.Input,
  ): Promise<Result<CreateProjectUseCase.Output, CreateProjectUseCase.Error>>;
}

export const CreateProjectUseCase = createAbstraction<ICreateProjectUseCase>(
  "Projects/CreateProjectUseCase",
);

export namespace CreateProjectUseCase {
  export type Interface = ICreateProjectUseCase;
  export type Input = ICreateProjectInput;
  export type Output = ICreateProjectOutput;
  export type Error = ValidationError | ProjectPersistenceError;
}
