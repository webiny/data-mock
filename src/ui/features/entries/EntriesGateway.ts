import { Result } from "@webiny/stdlib";
import type { SeedEntry } from "~/shared/types.js";
import {
  listSeedEntriesRoute,
  getSeedEntryRoute,
  deleteProjectEntriesRoute,
} from "~/shared/routes/entries.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { EntriesGateway as Abstraction } from "./abstractions/EntriesGateway.js";

class EntriesGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(projectId: string): Promise<Result<SeedEntry[], HTTPError>> {
    const result = await this.httpClient.request(listSeedEntriesRoute, {
      params: { projectId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.seedEntries.items);
  }

  public async get(projectId: string, entryId: string): Promise<Result<SeedEntry, HTTPError>> {
    const result = await this.httpClient.request(getSeedEntryRoute, {
      params: { projectId, entryId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.seedEntry);
  }

  public async clear(projectId: string): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(deleteProjectEntriesRoute, {
      params: { projectId },
    });
  }
}

export const EntriesGateway = Abstraction.createImplementation({
  implementation: EntriesGatewayImpl,
  dependencies: [HTTPClient],
});
