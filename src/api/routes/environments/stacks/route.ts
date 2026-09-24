import { listEnvironmentStacksRoute } from "~/shared/routes/environments.js";
import { ListStacksRepository } from "~/shared/node/features/environments/stacks/abstractions/ListStacksRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listEnvironmentStacks = routeFactory(
  listEnvironmentStacksRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ListStacksRepository);
    const result = await repository.execute({ environmentId: params.environmentId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("stacks", result.value, result.value.length);
  },
);
