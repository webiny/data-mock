import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJobResult, SeedJobStatus } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface IUpdateSeedJobInput {
  id: string;
  status: SeedJobStatus;
  result?: SeedJobResult;
}

export interface IUpdateSeedJobRepository {
  execute(
    input: UpdateSeedJobRepository.Input,
  ): Promise<Result<void, UpdateSeedJobRepository.Error>>;
}

export const UpdateSeedJobRepository = createAbstraction<IUpdateSeedJobRepository>(
  "Seeding/UpdateSeedJobRepository",
);

export namespace UpdateSeedJobRepository {
  export type Interface = IUpdateSeedJobRepository;
  export type Input = IUpdateSeedJobInput;
  export type Error = ProjectPersistenceError;
}
