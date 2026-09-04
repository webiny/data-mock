import { listProjectTenantsRoute } from "~/shared/routes/tenants.js";
import { ListProjectTenantsRepository } from "~/shared/node/features/tenants/list/abstractions/ListProjectTenantsRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const listProjectTenants = routeFactory(
  listProjectTenantsRoute,
  async ({ params, container, send }) => {
    const repository = container.resolve(ListProjectTenantsRepository);
    const result = await repository.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.list("tenants", result.value, result.value.length);
  },
);
