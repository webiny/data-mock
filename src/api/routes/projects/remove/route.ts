import { removeProjectRoute } from "~/shared/routes/projects.js";
import { RemoveProjectUseCase } from "~/shared/node/features/projects/remove/abstractions/RemoveProjectUseCase.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const removeProject = routeFactory(
  removeProjectRoute,
  async ({ params, container, send }) => {
    const useCase = container.resolve(RemoveProjectUseCase);
    const result = await useCase.execute({ id: params.id });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.none();
  },
);
