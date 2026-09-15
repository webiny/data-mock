import { previewProjectSyncRoute } from "~/shared/routes/environments.js";
import { SyncPreviewService } from "~/shared/node/features/webinyCli/sync/preview/abstractions/SyncPreviewService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

/**
 * Nothing is stored here. The sync itself still runs as a job, from `POST .../sync`, once the user
 * has seen this and accepted it.
 */
export const previewProjectSync = routeFactory(
  previewProjectSyncRoute,
  async ({ params, container, send }) => {
    const result = await container
      .resolve(SyncPreviewService)
      .execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("preview", result.value);
  },
);
