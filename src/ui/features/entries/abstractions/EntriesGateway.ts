import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { SeedEntry } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IEntriesGateway {
  list(projectId: string): Promise<Result<SeedEntry[], HTTPError>>;
  get(projectId: string, entryId: string): Promise<Result<SeedEntry, HTTPError>>;
  clear(projectId: string): Promise<Result<void, HTTPError>>;
}

export const EntriesGateway = createAbstraction<IEntriesGateway>("Ui/EntriesGateway");

export namespace EntriesGateway {
  export type Interface = IEntriesGateway;
}
