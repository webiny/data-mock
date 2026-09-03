import { syncProjectTenantsRoute } from "~/shared/routes/tenants.js";
import { TenantSyncService } from "~/shared/node/features/tenants/sync/abstractions/TenantSyncService.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const syncProjectTenants = routeFactory(
  syncProjectTenantsRoute,
  async ({ params, container, send }) => {
    const syncService = container.resolve(TenantSyncService);
    const result = await syncService.execute({ projectId: params.projectId });

    if (result.isFail()) {
      return send.error(result.error);
    }

    return send.one("sync", result.value);
  },
);
