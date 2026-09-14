import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectEnvironment } from "~/shared/types.js";
import type { EnvironmentNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IUpdateEnvironmentRepositoryInput {
  id: string;
  region?: string | null;
  deployed?: boolean;
  apiUrl?: string | null;
  adminUrl?: string | null;
  apiToken?: string | null;
  tenant?: string;
  lastSyncedAt?: number | null;
}

export interface IUpdateEnvironmentRepository {
  execute(
    input: UpdateEnvironmentRepository.Input,
  ): Promise<Result<ProjectEnvironment, UpdateEnvironmentRepository.Error>>;
}

export const UpdateEnvironmentRepository = createAbstraction<IUpdateEnvironmentRepository>(
  "Environments/UpdateEnvironmentRepository",
);

export namespace UpdateEnvironmentRepository {
  export type Interface = IUpdateEnvironmentRepository;
  export type Input = IUpdateEnvironmentRepositoryInput;
  export type Error = EnvironmentNotFoundError | ProjectPersistenceError;
}
