import { removeProjectRoute } from "~/shared/routes/projects.js";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const removeProject = routeFactory(
  removeProjectRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ProjectRepository);
    const result = await repository.remove(params.id);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
