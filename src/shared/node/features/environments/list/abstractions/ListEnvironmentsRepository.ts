import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectEnvironment } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListEnvironmentsRepositoryInput {
  projectId: string;
  /**
   * Archived environments are hidden unless this is set. Sync sets it: an archived environment
   * still occupies its (project, env, variant) slot, so discovery must see it or it will try to
   * insert a duplicate and hit the unique index.
   */
  includeArchived?: boolean;
}

export interface IListEnvironmentsRepository {
  execute(
    input: ListEnvironmentsRepository.Input,
  ): Promise<Result<ProjectEnvironment[], ListEnvironmentsRepository.Error>>;
}

export const ListEnvironmentsRepository = createAbstraction<IListEnvironmentsRepository>(
  "Environments/ListEnvironmentsRepository",
);

export namespace ListEnvironmentsRepository {
  export type Interface = IListEnvironmentsRepository;
  export type Input = IListEnvironmentsRepositoryInput;
  export type Error = ProjectPersistenceError;
}
