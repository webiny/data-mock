import { syncProjectTenantsRoute } from "~/shared/routes/tenants.js";
import { TenantSyncService } from "~/shared/node/features/tenants/sync/abstractions/TenantSyncService.js";
import { CreateSyncLogRepository } from "~/shared/node/features/syncLogs/create/abstractions/CreateSyncLogRepository.js";
import { routeFactory } from "~/api/routing/routeFactory.js";

export const syncProjectTenants = routeFactory(
  syncProjectTenantsRoute,
  async ({ params, container, send }) => {
    const syncService = container.resolve(TenantSyncService);
    const syncLogRepository = container.resolve(CreateSyncLogRepository);
    const result = await syncService.execute({ projectId: params.projectId });

    if (result.isFail()) {
      await syncLogRepository.execute({
        projectId: params.projectId,
        type: "tenants",
        status: "error",
        message: result.error.message,
        response: result.error.data,
      });
      return send.error(result.error);
    }

    const { operations, ...summary } = result.value;

    await syncLogRepository.execute({
      projectId: params.projectId,
      type: "tenants",
      status: "success",
      message: `Synced ${summary.synced} tenant(s)`,
      request: operations,
      response: summary,
    });

    return send.one("sync", result.value);
  },
);
