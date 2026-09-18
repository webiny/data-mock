import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob } from "~/shared/types.js";
import type { ProjectPersistenceError, JobNotFoundError } from "~/shared/errors.js";

export interface IGetSeedJobInput {
  id: string;
}

export interface IGetSeedJobRepository {
  execute(input: GetSeedJobRepository.Input): Promise<Result<SeedJob, GetSeedJobRepository.Error>>;
}

export const GetSeedJobRepository = createAbstraction<IGetSeedJobRepository>(
  "Seeding/GetSeedJobRepository",
);

export namespace GetSeedJobRepository {
  export type Interface = IGetSeedJobRepository;
  export type Input = IGetSeedJobInput;
  export type Error = ProjectPersistenceError | JobNotFoundError;
}
