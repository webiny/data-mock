import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListSeedJobsInput {
  projectId: string;
}

export interface IListSeedJobsRepository {
  execute(
    input: ListSeedJobsRepository.Input,
  ): Promise<Result<SeedJob[], ListSeedJobsRepository.Error>>;
}

export const ListSeedJobsRepository = createAbstraction<IListSeedJobsRepository>(
  "Seeding/ListSeedJobsRepository",
);

export namespace ListSeedJobsRepository {
  export type Interface = IListSeedJobsRepository;
  export type Input = IListSeedJobsInput;
  export type Error = ProjectPersistenceError;
}
