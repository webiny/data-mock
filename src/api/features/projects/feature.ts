import { createFeature } from "@webiny/stdlib";
import { ListProjectsUseCase } from "./list/ListProjectsUseCase.js";
import { GetProjectUseCase } from "./get/GetProjectUseCase.js";
import { CreateProjectUseCase } from "./create/CreateProjectUseCase.js";
import { RemoveProjectUseCase } from "./remove/RemoveProjectUseCase.js";

export const ProjectsApiFeature = createFeature({
  name: "Api/ProjectsApiFeature",
  register(container) {
    container.register(ListProjectsUseCase);
    container.register(GetProjectUseCase);
    container.register(CreateProjectUseCase);
    container.register(RemoveProjectUseCase);
  },
});
