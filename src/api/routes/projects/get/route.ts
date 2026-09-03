import { getProjectRoute } from "~/shared/routes/projects.js";
import { GetProjectUseCase } from "~/api/features/projects/get/abstractions/GetProjectUseCase.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const getProject = routeFactory(getProjectRoute, async ({ params, container, send }) => {
  const useCase = container.resolve(GetProjectUseCase);
  const result = await useCase.execute({ id: params.id });

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.one("project", result.value);
});
