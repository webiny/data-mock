import { projectDeletionImpactRoute } from "~/shared/routes/projects.js";
import { DeletionImpactService } from "~/shared/node/features/deletion/impact/abstractions/DeletionImpactService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const getProjectDeletionImpact = routeFactory(
  projectDeletionImpactRoute,
  async ({ params, container, send }) => {
    const service = container.resolve(DeletionImpactService);
    const result = await service.execute({ scope: "project", id: params.id });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("impact", result.value);
  },
);
