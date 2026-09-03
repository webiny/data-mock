import { createProjectRoute } from "~/shared/routes/projects.js";
import { CreateProjectUseCase } from "~/shared/node/features/projects/create/abstractions/CreateProjectUseCase.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const createProject = routeFactory(createProjectRoute, async ({ body, container, send }) => {
  const useCase = container.resolve(CreateProjectUseCase);
  const result = await useCase.execute(body);

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.one("project", result.value, 201);
});
