import { environmentDeletionImpactRoute } from "~/shared/routes/environments.js";
import { DeletionImpactService } from "~/shared/node/features/deletion/impact/abstractions/DeletionImpactService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const getEnvironmentDeletionImpact = routeFactory(
  environmentDeletionImpactRoute,
  async ({ params, container, send }) => {
    const service = container.resolve(DeletionImpactService);
    const result = await service.execute({ scope: "environment", id: params.environmentId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("impact", result.value);
  },
);
