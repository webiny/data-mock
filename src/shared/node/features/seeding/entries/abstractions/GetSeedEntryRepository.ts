import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedEntry } from "~/shared/types.js";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IGetSeedEntryInput {
  id: string;
}

export interface IGetSeedEntryRepository {
  execute(
    input: GetSeedEntryRepository.Input,
  ): Promise<Result<SeedEntry, GetSeedEntryRepository.Error>>;
}

export const GetSeedEntryRepository = createAbstraction<IGetSeedEntryRepository>(
  "Seeding/GetSeedEntryRepository",
);

export namespace GetSeedEntryRepository {
  export type Interface = IGetSeedEntryRepository;
  export type Input = IGetSeedEntryInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
