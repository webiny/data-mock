import { listSeedEntriesRoute } from "~/shared/routes/entries.js";
import { ListSeedEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/ListSeedEntriesRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listSeedEntries = routeFactory(
  listSeedEntriesRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ListSeedEntriesRepository);
    const result = await repository.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("seedEntries", result.value.entries, result.value.total);
  },
);
