import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedJobsListResult } from "~/ui/features/seeding/abstractions/SeedingGateway.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

import type { EnvironmentRef } from "~/shared/types.js";
export interface ILoadSeedHistoryUseCase {
  execute(ref: EnvironmentRef): Promise<Result<SeedJobsListResult, HTTPError>>;
}

export const LoadSeedHistoryUseCase = createAbstraction<ILoadSeedHistoryUseCase>(
  "Ui/LoadSeedHistoryUseCase",
);

export namespace LoadSeedHistoryUseCase {
  export type Interface = ILoadSeedHistoryUseCase;
}
