import { Result } from "@webiny/stdlib";
import type { SeedEntry } from "~/shared/types.js";
import { getSeedEntryRoute, deleteProjectEntriesRoute } from "~/shared/routes/entries.js";
import { HTTPClient } from "~/ui/infrastructure/httpClient/abstractions/HTTPClient.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";
import { EntriesGateway as Abstraction } from "./abstractions/EntriesGateway.js";
import type { EntriesListResult, EntriesListParams } from "./abstractions/EntriesGateway.js";
import type { EnvironmentRef } from "~/shared/types.js";

interface EntriesListResponse {
  seedEntries: { items: SeedEntry[]; total: number };
}

class EntriesGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(
    ref: EnvironmentRef,
    params?: EntriesListParams,
  ): Promise<Result<EntriesListResult, HTTPError>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 25;
    const parts = [`page=${page}`, `limit=${limit}`];
    if (params?.jobId) {
      parts.push(`jobId=${params.jobId}`);
    }
    if (params?.modelId) {
      parts.push(`modelId=${params.modelId}`);
    }
    if (params?.tenant) {
      parts.push(`tenant=${params.tenant}`);
    }
    if (params?.status) {
      parts.push(`status=${params.status}`);
    }
    const qs = parts.join("&");

    const result = await this.httpClient.get<EntriesListResponse>(
      `/api/projects/${ref.projectId}/environments/${ref.environmentId}/entries?${qs}`,
    );

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
