import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedEntry } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface EntriesListResult {
  entries: SeedEntry[];
  total: number;
}

export interface EntriesListParams {
  page?: number;
  limit?: number;
  jobId?: string;
  modelId?: string;
  tenant?: string;
  status?: string;
}

export interface IEntriesGateway {
  list(
    projectId: string,
    params?: EntriesListParams,
  ): Promise<Result<EntriesListResult, HTTPError>>;
  get(projectId: string, entryId: string): Promise<Result<SeedEntry, HTTPError>>;
  clear(projectId: string): Promise<Result<void, HTTPError>>;
}

export const EntriesGateway = createAbstraction<IEntriesGateway>("Ui/EntriesGateway");

export namespace EntriesGateway {
  export type Interface = IEntriesGateway;
}
