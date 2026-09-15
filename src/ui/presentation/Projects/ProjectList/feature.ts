import { createFeature } from "~/ui/di/createFeature.js";
import { ProjectsFeature } from "~/ui/features/projects/feature.js";
import { EnvironmentsFeature } from "~/ui/features/environments/feature.js";
import { JobsFeature } from "~/ui/features/jobs/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { ProjectListPresenter as ProjectListPresenterAbstraction } from "./abstractions/ProjectListPresenter.js";
import { ProjectListPresenter } from "./ProjectListPresenter.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/LoadProjectsUseCase.js";
import { ArchiveProjectUseCase } from "./useCases/ArchiveProject/ArchiveProjectUseCase.js";
import { RestoreProjectUseCase } from "./useCases/RestoreProject/RestoreProjectUseCase.js";
import { PurgeProjectUseCase } from "./useCases/PurgeProject/PurgeProjectUseCase.js";

interface ProjectListExports {
  presenter: ProjectListPresenterAbstraction.Interface;
}

export const ProjectListPresentationFeature = createFeature<void, ProjectListExports>({
  name: "Ui/ProjectListPresentationFeature",
  dependencies: [ProjectsFeature, EnvironmentsFeature, JobsFeature, NotificationsFeature],
  register(container) {
    container.register(LoadProjectsUseCase);
    container.register(ArchiveProjectUseCase);
    container.register(RestoreProjectUseCase);
    container.register(PurgeProjectUseCase);
    container.register(ProjectListPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(ProjectListPresenterAbstraction),
    };
  },
});
