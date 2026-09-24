import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IArchiveProjectRepositoryInput {
  id: string;
  /** `false` restores the project. */
  archived: boolean;
}

export interface IArchiveProjectRepository {
  execute(
    input: ArchiveProjectRepository.Input,
  ): Promise<Result<Project, ArchiveProjectRepository.Error>>;
}

export const ArchiveProjectRepository = createAbstraction<IArchiveProjectRepository>(
  "Projects/ArchiveProjectRepository",
);

export namespace ArchiveProjectRepository {
  export type Interface = IArchiveProjectRepository;
  export type Input = IArchiveProjectRepositoryInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
