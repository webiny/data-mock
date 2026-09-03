import { listProjectsRoute } from "~/shared/routes/projects.js";
import { ListProjectsUseCase } from "~/shared/node/features/projects/list/abstractions/ListProjectsUseCase.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listProjects = routeFactory(listProjectsRoute, async ({ container, send }) => {
  const useCase = container.resolve(ListProjectsUseCase);
  const result = await useCase.execute();

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.list("projects", result.value.projects, result.value.total);
});
