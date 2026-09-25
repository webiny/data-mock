import { listProjectModelsRoute } from "~/shared/routes/models.js";
import { ListProjectModelsRepository } from "~/shared/node/features/models/list/abstractions/ListProjectModelsRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";
import { getStringFilter } from "~/api/routing/parseListQuery.js";

export const listProjectModels = routeFactory(
  listProjectModelsRoute,
  async ({ params, query, container, send }) => {
    const repository = container.resolve(ListProjectModelsRepository);
    // Models are stored per tenant; each row says which. `?tenant=` narrows to one.
    const result = await repository.execute({
      environmentId: params.environmentId,
      tenant: getStringFilter(query, "tenant"),
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("models", result.value, result.value.length);
  },
);
