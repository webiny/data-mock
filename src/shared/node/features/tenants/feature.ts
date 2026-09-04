import { createFeature } from "@webiny/stdlib";
import { ListProjectTenantsRepository } from "./list/ListProjectTenantsRepository.js";
import { SyncProjectTenantsRepository } from "./sync/SyncProjectTenantsRepository.js";
import { TenantSyncService } from "./sync/TenantSyncService.js";
import { VerifyProjectAccessService } from "./verify/VerifyProjectAccessService.js";

export const TenantsFeature = createFeature({
  name: "Shared/TenantsFeature",
  register(container) {
    container.register(ListProjectTenantsRepository).inSingletonScope();
    container.register(SyncProjectTenantsRepository).inSingletonScope();

    container.register(TenantSyncService);
    container.register(VerifyProjectAccessService);
  },
});
