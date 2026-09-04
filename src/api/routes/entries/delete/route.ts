import { deleteProjectEntriesRoute } from "~/shared/routes/entries.js";
import { DeleteProjectEntriesRepository } from "~/shared/node/features/seeding/entries/abstractions/DeleteProjectEntriesRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const deleteProjectEntries = routeFactory(
  deleteProjectEntriesRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(DeleteProjectEntriesRepository);
    const result = await repository.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
