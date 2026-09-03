import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedEntry, SeedEntryStatus } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ICreateSeedEntryInput {
  jobId: string | null;
  projectId: string;
  tenant: string;
  modelId: string;
  entryId: string;
  entryData: Record<string, unknown>;
  responseData: Record<string, unknown> | null;
  httpStatus: number | null;
  status: SeedEntryStatus;
  error: string | null;
}

export interface ICreateSeedEntryRepository {
  execute(
    input: CreateSeedEntryRepository.Input,
  ): Promise<Result<SeedEntry, CreateSeedEntryRepository.Error>>;
}

export const CreateSeedEntryRepository = createAbstraction<ICreateSeedEntryRepository>(
  "Seeding/CreateSeedEntryRepository",
);

export namespace CreateSeedEntryRepository {
  export type Interface = ICreateSeedEntryRepository;
  export type Input = ICreateSeedEntryInput;
  export type Error = ProjectPersistenceError;
}
