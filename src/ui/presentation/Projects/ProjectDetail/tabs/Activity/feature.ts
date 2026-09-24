import { createFeature } from "~/ui/di/createFeature.js";
import { SyncLogsFeature } from "~/ui/features/syncLogs/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { URLListStateFeature } from "~/ui/features/router/URLListStateFeature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { ActivityTabPresenter as Abstraction } from "./abstractions/ActivityTabPresenter.js";
import { ActivityTabPresenter } from "./ActivityTabPresenter.js";

interface ActivityTabExports {
  presenter: Abstraction.Interface;
}

export const ActivityTabFeature = createFeature<void, ActivityTabExports>({
  name: "Ui/ActivityTabFeature",
  dependencies: [SyncLogsFeature, NotificationsFeature, URLListStateFeature, EventsFeature],
  register(container) {
    container.register(ActivityTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
