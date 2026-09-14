import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectEnvironment } from "~/shared/types.js";
import type { EnvironmentNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IArchiveEnvironmentRepositoryInput {
  id: string;
  /** `false` restores the environment. */
  archived: boolean;
}

export interface IArchiveEnvironmentRepository {
  execute(
    input: ArchiveEnvironmentRepository.Input,
  ): Promise<Result<ProjectEnvironment, ArchiveEnvironmentRepository.Error>>;
}

export const ArchiveEnvironmentRepository = createAbstraction<IArchiveEnvironmentRepository>(
  "Environments/ArchiveEnvironmentRepository",
);

export namespace ArchiveEnvironmentRepository {
  export type Interface = IArchiveEnvironmentRepository;
  export type Input = IArchiveEnvironmentRepositoryInput;
  export type Error = EnvironmentNotFoundError | ProjectPersistenceError;
}
