import { archiveProjectRoute } from "~/shared/routes/projects.js";
import { ArchiveProjectRepository } from "~/shared/node/features/projects/archive/abstractions/ArchiveProjectRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const archiveProject = routeFactory(
  archiveProjectRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ArchiveProjectRepository);
    const result = await repository.execute({ id: params.id, archived: true });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("project", result.value);
  },
);
