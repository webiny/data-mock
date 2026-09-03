import { createFeature } from "~/ui/di/createFeature.js";
import { ProjectsFeature } from "~/ui/features/projects/feature.js";
import { ProjectListPresenter as ProjectListPresenterAbstraction } from "./abstractions/ProjectListPresenter.js";
import { ProjectListPresenter } from "./ProjectListPresenter.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/LoadProjectsUseCase.js";
import { DeleteProjectUseCase } from "./useCases/DeleteProject/DeleteProjectUseCase.js";

interface ProjectListExports {
  presenter: ProjectListPresenterAbstraction.Interface;
}

export const ProjectListPresentationFeature = createFeature<void, ProjectListExports>({
  name: "Ui/ProjectListPresentationFeature",
  dependencies: [ProjectsFeature],
  register(container) {
    container.register(LoadProjectsUseCase);
    container.register(DeleteProjectUseCase);
    container.register(ProjectListPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(ProjectListPresenterAbstraction),
    };
  },
});
