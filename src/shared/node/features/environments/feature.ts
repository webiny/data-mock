import { createFeature } from "@webiny/stdlib";
import { CreateEnvironmentRepository } from "./create/CreateEnvironmentRepository.js";
import { GetEnvironmentRepository } from "./get/GetEnvironmentRepository.js";
import { ListEnvironmentsRepository } from "./list/ListEnvironmentsRepository.js";
import { UpdateEnvironmentRepository } from "./update/UpdateEnvironmentRepository.js";
import { RemoveEnvironmentRepository } from "./remove/RemoveEnvironmentRepository.js";
import { ListStacksRepository } from "./stacks/ListStacksRepository.js";
import { UpsertStackRepository } from "./stacks/UpsertStackRepository.js";
import { EnvironmentContextService } from "./context/EnvironmentContextService.js";

export const EnvironmentsFeature = createFeature({
  name: "Shared/EnvironmentsFeature",
  register(container) {
    container.register(CreateEnvironmentRepository).inSingletonScope();
    container.register(GetEnvironmentRepository).inSingletonScope();
    container.register(ListEnvironmentsRepository).inSingletonScope();
    container.register(UpdateEnvironmentRepository).inSingletonScope();
    container.register(RemoveEnvironmentRepository).inSingletonScope();
    container.register(ListStacksRepository).inSingletonScope();
    container.register(UpsertStackRepository).inSingletonScope();
    container.register(EnvironmentContextService).inSingletonScope();
  },
});
