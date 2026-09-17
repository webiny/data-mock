import { createFeature } from "~/ui/di/createFeature.js";
import { ProjectsFeature } from "~/ui/features/projects/feature.js";
import { EnvironmentsFeature } from "~/ui/features/environments/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { JobsFeature } from "~/ui/features/jobs/feature.js";
import { TenantsTabFeature } from "./tabs/Tenants/feature.js";
import { ModelsTabFeature } from "./tabs/Models/feature.js";
import { FilesTabFeature } from "./tabs/Files/feature.js";
import { EntriesTabFeature } from "./tabs/Entries/feature.js";
import { SeedHistoryTabFeature } from "./tabs/SeedHistory/feature.js";
import { TemplatesTabFeature } from "./tabs/Templates/feature.js";
import { JobsTabFeature } from "./tabs/Jobs/feature.js";
import { ActivityTabFeature } from "./tabs/Activity/feature.js";
import { PullTenantsTabFeature } from "./tabs/PullTenants/feature.js";
import { PullModelsTabFeature } from "./tabs/PullModels/feature.js";
import { PullImagesTabFeature } from "./tabs/PullImages/feature.js";
import { ImportEntriesTabFeature } from "./tabs/ImportEntries/feature.js";
import { ProjectDetailPresenter as ProjectDetailPresenterAbstraction } from "./abstractions/ProjectDetailPresenter.js";
import { ProjectDetailPresenter } from "./ProjectDetailPresenter.js";
import { LoadProjectDetailUseCase } from "./useCases/LoadProjectDetail/LoadProjectDetailUseCase.js";

interface ProjectDetailExports {
  presenter: ProjectDetailPresenterAbstraction.Interface;
}

export const ProjectDetailPresentationFeature = createFeature<void, ProjectDetailExports>({
  name: "Ui/ProjectDetailPresentationFeature",
  dependencies: [
    ProjectsFeature,
    EnvironmentsFeature,
    NotificationsFeature,
    EventsFeature,
    JobsFeature,
    // Each tab owns its own presenter and its own data. They are registered here so that a tab
    // component can resolve its feature the moment it mounts, without the page knowing which tabs
    // exist.
    TenantsTabFeature,
    ModelsTabFeature,
    FilesTabFeature,
    EntriesTabFeature,
    SeedHistoryTabFeature,
    TemplatesTabFeature,
    JobsTabFeature,
    ActivityTabFeature,
    PullTenantsTabFeature,
    PullModelsTabFeature,
    PullImagesTabFeature,
    ImportEntriesTabFeature,
  ],
  register(container) {
    container.register(LoadProjectDetailUseCase);
    container.register(ProjectDetailPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(ProjectDetailPresenterAbstraction),
    };
  },
});
