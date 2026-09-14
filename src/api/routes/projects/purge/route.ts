import { purgeProjectRoute } from "~/shared/routes/projects.js";
import { RemoveProjectUseCase } from "~/shared/node/features/projects/remove/abstractions/RemoveProjectUseCase.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

/**
 * Hard delete. Everything that cascades from the project goes with it — seed entries, sync logs,
 * job history, models, tenants and files. The UI must show `projectDeletionImpactRoute` first.
 */
export const purgeProject = routeFactory(purgeProjectRoute, async ({ params, container, send }) => {
  const useCase = container.resolve(RemoveProjectUseCase);
  const result = await useCase.execute({ id: params.id });

  if (result.isFail()) {
    return send.error(result.error);
  }

  return send.none();
});
