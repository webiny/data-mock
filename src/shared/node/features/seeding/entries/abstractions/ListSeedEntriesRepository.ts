import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedEntry, SeedEntryStatus } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IListSeedEntriesInput {
  projectId: string;
  modelId?: string;
  tenant?: string;
  jobId?: string;
  status?: SeedEntryStatus;
  limit?: number;
  offset?: number;
}

export interface IListSeedEntriesOutput {
  entries: SeedEntry[];
  total: number;
}

export interface IListSeedEntriesRepository {
  execute(
    input: ListSeedEntriesRepository.Input,
  ): Promise<Result<ListSeedEntriesRepository.Output, ListSeedEntriesRepository.Error>>;
}

export const ListSeedEntriesRepository = createAbstraction<IListSeedEntriesRepository>(
  "Seeding/ListSeedEntriesRepository",
);

export namespace ListSeedEntriesRepository {
  export type Interface = IListSeedEntriesRepository;
  export type Input = IListSeedEntriesInput;
  export type Output = IListSeedEntriesOutput;
  export type Error = ProjectPersistenceError;
}
