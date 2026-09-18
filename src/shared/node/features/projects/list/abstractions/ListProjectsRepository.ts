import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectsRepositoryInput {
  /** Archived projects are hidden unless this is set. */
  includeArchived?: boolean;
}

export interface IListProjectsRepository {
  execute(
    input?: ListProjectsRepository.Input,
  ): Promise<Result<Project[], ProjectPersistenceError>>;
}

export const ListProjectsRepository = createAbstraction<IListProjectsRepository>(
  "Projects/ListProjectsRepository",
);

export namespace ListProjectsRepository {
  export type Interface = IListProjectsRepository;
  export type Input = IListProjectsRepositoryInput;
  export type Error = ProjectPersistenceError;
}
