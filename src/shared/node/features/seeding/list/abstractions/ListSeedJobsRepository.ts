import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJob, SeedJobStatus } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListSeedJobsInput {
  projectId: string;
  status?: SeedJobStatus;
  limit?: number;
  offset?: number;
  sortField?: string;
  sortDir?: "asc" | "desc";
}

export interface IListSeedJobsOutput {
  seedJobs: SeedJob[];
  total: number;
}

export interface IListSeedJobsRepository {
  execute(
    input: ListSeedJobsRepository.Input,
  ): Promise<Result<ListSeedJobsRepository.Output, ListSeedJobsRepository.Error>>;
}

export const ListSeedJobsRepository = createAbstraction<IListSeedJobsRepository>(
  "Seeding/ListSeedJobsRepository",
);

export namespace ListSeedJobsRepository {
  export type Interface = IListSeedJobsRepository;
  export type Input = IListSeedJobsInput;
  export type Output = IListSeedJobsOutput;
  export type Error = ProjectPersistenceError;
}
