import { listSeedEntriesRoute } from "~/shared/routes/entries.js";
import { ListSeedEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import type { SeedEntryStatus } from "~/shared/types.js";

const DEFAULT_LIMIT = 25;

export const listSeedEntries = routeFactory(
  listSeedEntriesRoute,
  async ({ params, query, container, send }) => {
    const limit = Math.min(Math.max(parseInt(query.limit ?? "", 10) || DEFAULT_LIMIT, 1), 1000);
    const page = Math.max(parseInt(query.page ?? "", 10) || 1, 1);
    const offset = (page - 1) * limit;

    const repository = container.resolve(ListSeedEntriesRepository);
    const input: Parameters<typeof repository.execute>[0] = {
      projectId: params.projectId,
      limit,
      offset,
    };
    if (query.jobId) {
      input.jobId = query.jobId;
    }
    if (query.modelId) {
      input.modelId = query.modelId;
    }
    if (query.tenant) {
      input.tenant = query.tenant;
    }
    if (query.status) {
      input.status = query.status as SeedEntryStatus;
    }
    const result = await repository.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("seedEntries", result.value.entries, result.value.total);
  },
);
