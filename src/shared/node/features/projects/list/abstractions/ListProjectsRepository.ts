import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectsRepository {
  execute(): Promise<Result<Project[], ProjectPersistenceError>>;
}

export const ListProjectsRepository = createAbstraction<IListProjectsRepository>(
  "Projects/ListProjectsRepository",
);

export namespace ListProjectsRepository {
  export type Interface = IListProjectsRepository;
  export type Error = ProjectPersistenceError;
}
