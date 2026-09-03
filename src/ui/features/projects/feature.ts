import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { ProjectsGateway } from "./ProjectsGateway.js";
import { ProjectsRepository as ProjectsRepositoryAbstraction } from "./abstractions/ProjectsRepository.js";
import { ProjectsRepositoryImpl } from "./ProjectsRepository.js";

export const ProjectsFeature = createFeature({
  name: "Ui/ProjectsFeature",
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(ProjectsGateway).inSingletonScope();
    container.registerInstance(ProjectsRepositoryAbstraction, new ProjectsRepositoryImpl());
  },
});
