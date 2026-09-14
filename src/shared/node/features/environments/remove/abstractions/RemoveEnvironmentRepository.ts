import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { EnvironmentNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IRemoveEnvironmentRepositoryInput {
  id: string;
}

export interface IRemoveEnvironmentRepository {
  execute(
    input: RemoveEnvironmentRepository.Input,
  ): Promise<Result<void, RemoveEnvironmentRepository.Error>>;
}

export const RemoveEnvironmentRepository = createAbstraction<IRemoveEnvironmentRepository>(
  "Environments/RemoveEnvironmentRepository",
);

export namespace RemoveEnvironmentRepository {
  export type Interface = IRemoveEnvironmentRepository;
  export type Input = IRemoveEnvironmentRepositoryInput;
  export type Error = EnvironmentNotFoundError | ProjectPersistenceError;
}
