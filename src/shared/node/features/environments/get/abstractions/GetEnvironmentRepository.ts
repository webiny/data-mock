import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectEnvironment } from "~/shared/types.js";
import type { EnvironmentNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IGetEnvironmentRepositoryInput {
  id: string;
}

export interface IGetEnvironmentRepository {
  execute(
    input: GetEnvironmentRepository.Input,
  ): Promise<Result<ProjectEnvironment, GetEnvironmentRepository.Error>>;
}

export const GetEnvironmentRepository = createAbstraction<IGetEnvironmentRepository>(
  "Environments/GetEnvironmentRepository",
);

export namespace GetEnvironmentRepository {
  export type Interface = IGetEnvironmentRepository;
  export type Input = IGetEnvironmentRepositoryInput;
  export type Error = EnvironmentNotFoundError | ProjectPersistenceError;
}
