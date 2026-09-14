import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectsInput {
  /** Archived projects are hidden unless this is set. */
  includeArchived?: boolean;
}

export interface IListProjectsUseCase {
  execute(
    input?: ListProjectsUseCase.Input,
  ): Promise<Result<IListProjectsResult, ProjectPersistenceError>>;
}

export interface IListProjectsResult {
  projects: Project[];
  total: number;
}

export const ListProjectsUseCase = createAbstraction<IListProjectsUseCase>(
  "Projects/ListProjectsUseCase",
);

export namespace ListProjectsUseCase {
  export type Interface = IListProjectsUseCase;
  export type Input = IListProjectsInput;
  export type UseCaseResult = IListProjectsResult;
  export type Error = ProjectPersistenceError;
}
