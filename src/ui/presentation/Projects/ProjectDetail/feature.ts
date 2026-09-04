import { createFeature } from "~/ui/di/createFeature.js";
import { ProjectsFeature } from "~/ui/features/projects/feature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { ModelsFeature } from "~/ui/features/models/feature.js";
import { SeedingFeature } from "~/ui/features/seeding/feature.js";
import { TemplatesFeature } from "~/ui/features/templates/feature.js";
import { FilesFeature } from "~/ui/features/files/feature.js";
import { EntriesFeature } from "~/ui/features/entries/feature.js";
import { SyncLogsFeature } from "~/ui/features/syncLogs/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { URLListStateFeature } from "~/ui/features/router/URLListStateFeature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { JobsFeature } from "~/ui/features/jobs/feature.js";
import { ProjectDetailPresenter as ProjectDetailPresenterAbstraction } from "./abstractions/ProjectDetailPresenter.js";
import { ProjectDetailPresenter } from "./ProjectDetailPresenter.js";
import { LoadProjectDetailUseCase } from "./useCases/LoadProjectDetail/LoadProjectDetailUseCase.js";
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
    FilesFeature,
    EntriesFeature,
    SyncLogsFeature,
    NotificationsFeature,
    URLListStateFeature,
    EventsFeature,
    JobsFeature,
  ],
  register(container) {
    container.register(LoadProjectDetailUseCase);
    container.register(DeleteTemplateUseCase);
    container.register(ProjectDetailPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(ProjectDetailPresenterAbstraction),
    };
  },
});
