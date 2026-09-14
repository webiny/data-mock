import { createFeature } from "~/ui/di/createFeature.js";
import { ProjectsFeature } from "~/ui/features/projects/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { FileSystemFeature } from "~/ui/features/filesystem/feature.js";
import { EnvironmentsFeature } from "~/ui/features/environments/feature.js";
import { AddProjectPresenter as AddProjectPresenterAbstraction } from "./abstractions/AddProjectPresenter.js";
import { AddProjectPresenter } from "./AddProjectPresenter.js";
import { CreateProjectUseCase } from "./useCases/CreateProject/CreateProjectUseCase.js";

interface AddProjectExports {
  presenter: AddProjectPresenterAbstraction.Interface;
}

export const AddProjectPresentationFeature = createFeature<void, AddProjectExports>({
  name: "Ui/AddProjectPresentationFeature",
  dependencies: [ProjectsFeature, NotificationsFeature, FileSystemFeature, EnvironmentsFeature],
  register(container) {
    container.register(CreateProjectUseCase);
    container.register(AddProjectPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(AddProjectPresenterAbstraction),
    };
  },
});
