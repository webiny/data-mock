import { createFeature } from "@webiny/stdlib";
import { CreateProjectRepository } from "./create/CreateProjectRepository.js";
import { CreateProjectUseCase } from "./create/CreateProjectUseCase.js";
import { GetProjectRepository } from "./get/GetProjectRepository.js";
import { GetProjectUseCase } from "./get/GetProjectUseCase.js";
import { ListProjectsRepository } from "./list/ListProjectsRepository.js";
import { ListProjectsUseCase } from "./list/ListProjectsUseCase.js";
import { RemoveProjectRepository } from "./remove/RemoveProjectRepository.js";
import { RemoveProjectUseCase } from "./remove/RemoveProjectUseCase.js";

export const ProjectsFeature = createFeature({
  name: "Shared/ProjectsFeature",
  register(container) {
    container.register(CreateProjectRepository).inSingletonScope();
    container.register(GetProjectRepository).inSingletonScope();
    container.register(ListProjectsRepository).inSingletonScope();
    container.register(RemoveProjectRepository).inSingletonScope();

    container.register(CreateProjectUseCase);
    container.register(GetProjectUseCase);
    container.register(ListProjectsUseCase);
    container.register(RemoveProjectUseCase);
  },
});
