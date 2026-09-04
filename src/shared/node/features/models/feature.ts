import { createFeature } from "@webiny/stdlib";
import { ListProjectGroupsRepository } from "./list/ListProjectGroupsRepository.js";
import { ListProjectModelsRepository } from "./list/ListProjectModelsRepository.js";
import { SyncProjectGroupsRepository } from "./sync/SyncProjectGroupsRepository.js";
import { SyncProjectModelsRepository } from "./sync/SyncProjectModelsRepository.js";
import { SyncModelsService } from "./sync/SyncModelsService.js";
import { GetProjectModelRepository } from "./get/GetProjectModelRepository.js";

export const ModelsFeature = createFeature({
  name: "Shared/ModelsFeature",
  register(container) {
    container.register(ListProjectGroupsRepository).inSingletonScope();
    container.register(ListProjectModelsRepository).inSingletonScope();
    container.register(SyncProjectGroupsRepository).inSingletonScope();
    container.register(SyncProjectModelsRepository).inSingletonScope();
    container.register(GetProjectModelRepository).inSingletonScope();

    container.register(SyncModelsService);
  },
});
