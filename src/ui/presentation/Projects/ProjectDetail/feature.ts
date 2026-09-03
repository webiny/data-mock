import { createFeature } from "~/ui/di/createFeature.js";
import { ProjectsFeature } from "~/ui/features/projects/feature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { ModelsFeature } from "~/ui/features/models/feature.js";
import { SeedingFeature } from "~/ui/features/seeding/feature.js";
import { TemplatesFeature } from "~/ui/features/templates/feature.js";
import { RouterFeature } from "~/ui/features/router/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { ProjectDetailPresenter as ProjectDetailPresenterAbstraction } from "./abstractions/ProjectDetailPresenter.js";
import { ProjectDetailPresenter } from "./ProjectDetailPresenter.js";
import { LoadProjectDetailUseCase } from "./useCases/LoadProjectDetail/LoadProjectDetailUseCase.js";
import { SyncAllUseCase } from "./useCases/SyncAll/SyncAllUseCase.js";
import { DeleteTemplateUseCase } from "./useCases/DeleteTemplate/DeleteTemplateUseCase.js";

interface ProjectDetailExports {
  presenter: ProjectDetailPresenterAbstraction.Interface;
}

export const ProjectDetailPresentationFeature = createFeature<void, ProjectDetailExports>({
  name: "Ui/ProjectDetailPresentationFeature",
  dependencies: [
    ProjectsFeature,
    TenantsFeature,
    ModelsFeature,
    SeedingFeature,
    TemplatesFeature,
    RouterFeature,
    NotificationsFeature,
  ],
  register(container) {
    container.register(LoadProjectDetailUseCase);
    container.register(SyncAllUseCase);
    container.register(DeleteTemplateUseCase);
    container.register(ProjectDetailPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(ProjectDetailPresenterAbstraction),
    };
  },
});
