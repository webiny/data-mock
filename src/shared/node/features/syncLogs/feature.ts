import { createFeature } from "@webiny/stdlib";
import { CreateSyncLogRepository } from "./create/CreateSyncLogRepository.js";
import { ListSyncLogsRepository } from "./list/ListSyncLogsRepository.js";

export const SyncLogsFeature = createFeature({
  name: "Shared/SyncLogsFeature",
  register(container) {
    container.register(CreateSyncLogRepository).inSingletonScope();
    container.register(ListSyncLogsRepository).inSingletonScope();
  },
});
