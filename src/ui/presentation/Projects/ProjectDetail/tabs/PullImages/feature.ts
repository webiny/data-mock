import { createFeature } from "~/ui/di/createFeature.js";
import { SyncLogsFeature } from "~/ui/features/syncLogs/feature.js";
import { FilesFeature } from "~/ui/features/files/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { PullImagesTabPresenter as Abstraction } from "./abstractions/PullImagesTabPresenter.js";
import { PullImagesTabPresenter } from "./PullImagesTabPresenter.js";

interface PullImagesTabExports {
  presenter: Abstraction.Interface;
}

export const PullImagesTabFeature = createFeature<void, PullImagesTabExports>({
  name: "Ui/PullImagesTabFeature",
  dependencies: [SyncLogsFeature, FilesFeature, NotificationsFeature, EventsFeature],
  register(container) {
    container.register(PullImagesTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
