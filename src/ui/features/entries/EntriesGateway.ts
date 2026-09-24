import { Result } from "@webiny/stdlib";
import {
  listSeedEntriesRoute,
  getSeedEntryRoute,
  deleteProjectEntriesRoute,
} from "~/shared/routes/entries.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { EntriesGateway as Abstraction } from "./abstractions/EntriesGateway.js";
import type { EntriesListResult, EntriesListParams } from "./abstractions/EntriesGateway.js";
import type { EnvironmentRef, SeedEntry } from "~/shared/types.js";

class EntriesGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(
    ref: EnvironmentRef,
    params?: EntriesListParams,
  ): Promise<Result<EntriesListResult, HTTPError>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 25;

    const result = await this.httpClient.request(listSeedEntriesRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId },
      query: {
        page: String(page),
        limit: String(limit),
        ...(params?.jobId ? { jobId: params.jobId } : {}),
        ...(params?.modelId ? { modelId: params.modelId } : {}),
        ...(params?.tenant ? { tenant: params.tenant } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok({
      entries: result.value.seedEntries.items,
      total: result.value.seedEntries.total,
    });
  }

  public async get(ref: EnvironmentRef, entryId: string): Promise<Result<SeedEntry, HTTPError>> {
    const result = await this.httpClient.request(getSeedEntryRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId, entryId },
    });

    if (result.isFail()) {
      return Result.fail(result.error);
    }

    return Result.ok(result.value.seedEntry);
  }

  public async clear(ref: EnvironmentRef): Promise<Result<void, HTTPError>> {
    return this.httpClient.request(deleteProjectEntriesRoute, {
      params: { projectId: ref.projectId, environmentId: ref.environmentId },
    });
  }
}

export const EntriesGateway = Abstraction.createImplementation({
  implementation: EntriesGatewayImpl,
  dependencies: [HTTPClient],
});
