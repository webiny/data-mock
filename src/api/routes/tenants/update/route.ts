import { updateProjectTenantRoute } from "~/shared/routes/tenants.js";
import { UpdateProjectTenantRepository } from "~/shared/node/features/tenants/update/abstractions/UpdateProjectTenantRepository.js";
import { EnvironmentHealthCache } from "~/api/health/abstractions/EnvironmentHealthCache.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const updateProjectTenant = routeFactory(
  updateProjectTenantRoute,
  async ({ params, body, container, send }) => {
    const repository = container.resolve(UpdateProjectTenantRepository);
    const result = await repository.execute({
      environmentId: params.environmentId,
      tenantId: params.tenantId,
      apiToken: body.apiToken,
    });

    if (result.isFail()) {
      return send.error(result.error);
    }

    // Health asks as the default tenant, whose token this may have been.
    container.resolve(EnvironmentHealthCache).forget(params.environmentId);

    return send.one("tenant", result.value);
  },
);
