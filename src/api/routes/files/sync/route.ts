import { pullProjectFilesRoute } from "~/shared/routes/files.js";
import { SyncFilesService } from "~/shared/node/features/files/sync/abstractions/SyncFilesService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const pullProjectFiles = routeFactory(
  pullProjectFilesRoute,
  async ({ params, body, container, send }) => {
    const service = container.resolve(SyncFilesService);
    const result = await service.execute({
      projectId: params.projectId,
      tenant: body.tenant,
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("result", { synced: result.value.synced });
  },
);
