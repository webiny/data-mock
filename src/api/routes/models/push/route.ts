import { pushProjectModelsRoute } from "~/shared/routes/models.js";
import { PushModelsService } from "~/shared/node/features/models/push/abstractions/PushModelsService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const pushProjectModels = routeFactory(
  pushProjectModelsRoute,
  async ({ params, container, send }) => {
    const pushService = container.resolve(PushModelsService);
    const result = await pushService.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("push", result.value);
  },
);
