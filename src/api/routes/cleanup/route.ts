import { cleanupEntriesRoute } from "~/shared/routes/cleanup.js";
import { CleanupService } from "~/shared/node/features/seeding/cleanup/abstractions/CleanupService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const cleanupEntries = routeFactory(
  cleanupEntriesRoute,
  async ({ params, body, container, send }) => {
    const cleanupService = container.resolve(CleanupService);
    const input: CleanupService.Input = { projectId: params.projectId };
    if (body?.jobId) {
      input.jobId = body.jobId;
    }
    const result = await cleanupService.execute(input);

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("cleanup", result.value);
  },
);
