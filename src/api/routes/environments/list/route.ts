import { listProjectEnvironmentsRoute } from "~/shared/routes/environments.js";
import { ListEnvironmentsRepository } from "~/shared/node/features/environments/list/abstractions/ListEnvironmentsRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listProjectEnvironments = routeFactory(
  listProjectEnvironmentsRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ListEnvironmentsRepository);
    const result = await repository.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("environments", result.value, result.value.length);
  },
);
