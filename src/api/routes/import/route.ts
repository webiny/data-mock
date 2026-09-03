import { importEntriesRoute } from "~/shared/routes/import.js";
import { ImportEntriesService } from "~/shared/node/features/seeding/import/abstractions/ImportEntriesService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const importEntries = routeFactory(
  importEntriesRoute,
  async ({ params, body, container, send }) => {
    const service = container.resolve(ImportEntriesService);
    const result = await service.execute({
      projectId: params.projectId,
      tenant: body.tenant,
      models: body.models,
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("import", result.value);
  },
);
