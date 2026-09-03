import { createFeature } from "@webiny/stdlib";
import { ProjectRepository } from "../ProjectRepository.js";

export const ProjectRepositoryFeature = createFeature({
  name: "Shared/ProjectRepositoryFeature",
  register(container) {
    container.register(ProjectRepository).inSingletonScope();
  },
});
