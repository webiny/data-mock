import { createFeature } from "~/ui/di/createFeature.js";
import { ProjectsFeature } from "~/ui/features/projects/feature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { ProjectListPresenter as ProjectListPresenterAbstraction } from "./abstractions/ProjectListPresenter.js";
import { ProjectListPresenter } from "./ProjectListPresenter.js";
import { LoadProjectsUseCase } from "./useCases/LoadProjects/LoadProjectsUseCase.js";
import { DeleteProjectUseCase } from "./useCases/DeleteProject/DeleteProjectUseCase.js";
import { LoadTenantsUseCase } from "./useCases/LoadTenants/LoadTenantsUseCase.js";
import { SyncTenantsUseCase } from "./useCases/SyncTenants/SyncTenantsUseCase.js";

interface ProjectListExports {
  presenter: ProjectListPresenterAbstraction.Interface;
}

export const ProjectListPresentationFeature = createFeature<void, ProjectListExports>({
  name: "Ui/ProjectListPresentationFeature",
  dependencies: [ProjectsFeature, TenantsFeature, NotificationsFeature],
  register(container) {
    container.register(LoadProjectsUseCase);
    container.register(DeleteProjectUseCase);
    container.register(LoadTenantsUseCase);
    container.register(SyncTenantsUseCase);
    container.register(ProjectListPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(ProjectListPresenterAbstraction),
    };
  },
});
