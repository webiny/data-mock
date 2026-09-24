import { createFeature } from "~/ui/di/createFeature.js";
import { FilesFeature } from "~/ui/features/files/feature.js";
import { LocalFilesFeature } from "~/ui/features/localFiles/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { FilesTabPresenter as Abstraction } from "./abstractions/FilesTabPresenter.js";
import { FilesTabPresenter } from "./FilesTabPresenter.js";

interface FilesTabExports {
  presenter: Abstraction.Interface;
}

export const FilesTabFeature = createFeature<void, FilesTabExports>({
  name: "Ui/FilesTabFeature",
  dependencies: [FilesFeature, LocalFilesFeature, NotificationsFeature, EventsFeature],
  register(container) {
    container.register(FilesTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
