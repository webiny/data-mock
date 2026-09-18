import { createFeature } from "~/ui/di/createFeature.js";
import { SyncLogsFeature } from "~/ui/features/syncLogs/feature.js";
import { ModelsFeature } from "~/ui/features/models/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { URLListStateFeature } from "~/ui/features/router/URLListStateFeature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { PullModelsTabPresenter as Abstraction } from "./abstractions/PullModelsTabPresenter.js";
import { PullModelsTabPresenter } from "./PullModelsTabPresenter.js";

interface PullModelsTabExports {
  presenter: Abstraction.Interface;
}

export const PullModelsTabFeature = createFeature<void, PullModelsTabExports>({
  name: "Ui/PullModelsTabFeature",
  dependencies: [
    SyncLogsFeature,
    ModelsFeature,
    NotificationsFeature,
    URLListStateFeature,
    EventsFeature,
  ],
  register(container) {
    container.register(PullModelsTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
