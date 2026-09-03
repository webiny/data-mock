import { getProjectRoute } from "~/shared/routes/projects.js";
import { ProjectRepository } from "~/shared/abstractions/ProjectRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const getProject = routeFactory<{ id: string }>(
  getProjectRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ProjectRepository);
    const result = await repository.getById(params.id);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("project", result.value);
  },
);
