import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectsUseCase {
  execute(): Promise<Result<IListProjectsResult, ProjectPersistenceError>>;
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
  export type UseCaseResult = IListProjectsResult;
  export type Error = ProjectPersistenceError;
}
