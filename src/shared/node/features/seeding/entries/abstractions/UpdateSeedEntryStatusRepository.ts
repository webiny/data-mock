import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedEntryStatus } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IUpdateSeedEntryStatusInput {
  id: string;
  status: SeedEntryStatus;
}

export interface IUpdateSeedEntryStatusRepository {
  execute(
    input: UpdateSeedEntryStatusRepository.Input,
  ): Promise<Result<void, UpdateSeedEntryStatusRepository.Error>>;
}

export const UpdateSeedEntryStatusRepository = createAbstraction<IUpdateSeedEntryStatusRepository>(
  "Seeding/UpdateSeedEntryStatusRepository",
);

export namespace UpdateSeedEntryStatusRepository {
  export type Interface = IUpdateSeedEntryStatusRepository;
  export type Input = IUpdateSeedEntryStatusInput;
  export type Error = ProjectPersistenceError;
}
