import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectGroup } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListProjectGroupsRepositoryInput {
  projectId: string;
}

export interface IListProjectGroupsRepository {
  execute(
    input: ListProjectGroupsRepository.Input,
  ): Promise<Result<ProjectGroup[], ListProjectGroupsRepository.Error>>;
}

export const ListProjectGroupsRepository = createAbstraction<IListProjectGroupsRepository>(
  "Models/ListProjectGroupsRepository",
);

export namespace ListProjectGroupsRepository {
  export type Interface = IListProjectGroupsRepository;
  export type Input = IListProjectGroupsRepositoryInput;
  export type Error = ProjectPersistenceError;
}
