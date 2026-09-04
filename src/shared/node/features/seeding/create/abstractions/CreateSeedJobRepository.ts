import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob, SeedJobConfig } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ICreateSeedJobInput {
  projectId: string;
  config: SeedJobConfig;
}

export interface ICreateSeedJobRepository {
  execute(
    input: CreateSeedJobRepository.Input,
  ): Promise<Result<SeedJob, CreateSeedJobRepository.Error>>;
}

export const CreateSeedJobRepository = createAbstraction<ICreateSeedJobRepository>(
  "Seeding/CreateSeedJobRepository",
);

export namespace CreateSeedJobRepository {
  export type Interface = ICreateSeedJobRepository;
  export type Input = ICreateSeedJobInput;
  export type Error = ProjectPersistenceError;
}
