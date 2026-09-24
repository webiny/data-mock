import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectEnvironment } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ICreateEnvironmentRepositoryInput {
  projectId: string;
  env: string;
  /** "" when unset — SQLite treats NULLs as distinct in unique indexes. */
  variant?: string;
  region?: string | null;
  deployed?: boolean;
  apiUrl?: string | null;
  adminUrl?: string | null;
  apiToken?: string | null;
  tenant?: string;
}

export interface ICreateEnvironmentRepository {
  execute(
    input: CreateEnvironmentRepository.Input,
  ): Promise<Result<ProjectEnvironment, CreateEnvironmentRepository.Error>>;
}

export const CreateEnvironmentRepository = createAbstraction<ICreateEnvironmentRepository>(
  "Environments/CreateEnvironmentRepository",
);

export namespace CreateEnvironmentRepository {
  export type Interface = ICreateEnvironmentRepository;
  export type Input = ICreateEnvironmentRepositoryInput;
  export type Error = ProjectPersistenceError;
}
