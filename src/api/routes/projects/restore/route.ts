import { restoreProjectRoute } from "~/shared/routes/projects.js";
import { ArchiveProjectRepository } from "~/shared/node/features/projects/archive/abstractions/ArchiveProjectRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const restoreProject = routeFactory(
  restoreProjectRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ArchiveProjectRepository);
    const result = await repository.execute({ id: params.id, archived: false });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("project", result.value);
  },
);
