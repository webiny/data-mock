import { listSeedEntriesRoute } from "~/shared/routes/entries.js";
import { ListSeedEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import { parseListQuery, getStringFilter } from "~/api/routing/parseListQuery.js";
import type { SeedEntryStatus } from "~/shared/types.js";
import type { ListSeedEntriesRepository as Abstraction } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";

function isSeedEntryStatus(value: string | undefined): value is SeedEntryStatus {
  return (
    value === "created" ||
    value === "failed" ||
    value === "dry-run" ||
    value === "imported" ||
    value === "deleted"
  );
}

export const listSeedEntries = routeFactory(
  listSeedEntriesRoute,
  async ({ params, query, container, send }) => {
    const { limit, offset } = parseListQuery(query);

    const input: Abstraction.Input = { environmentId: params.environmentId, limit, offset };
    const jobId = getStringFilter(query, "jobId");
    const modelId = getStringFilter(query, "modelId");
    const tenant = getStringFilter(query, "tenant");
    const status = getStringFilter(query, "status");
    if (jobId) {
      input.jobId = jobId;
    }
    if (modelId) {
      input.modelId = modelId;
    }
    if (tenant) {
      input.tenant = tenant;
    }
    // Guarded like every sibling filter. Cast straight through, an invalid `?status=` narrows the
    // query to nothing and reads as "no entries" rather than as a bad request.
    if (isSeedEntryStatus(status)) {
      input.status = status;
    }

    const repository = container.resolve(ListSeedEntriesRepository);
    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("seedEntries", result.value.entries, result.value.total);
  },
);
