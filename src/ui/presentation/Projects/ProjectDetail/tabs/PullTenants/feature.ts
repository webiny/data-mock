import { createFeature } from "~/ui/di/createFeature.js";
import { SyncLogsFeature } from "~/ui/features/syncLogs/feature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { URLListStateFeature } from "~/ui/features/router/URLListStateFeature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { PullTenantsTabPresenter as Abstraction } from "./abstractions/PullTenantsTabPresenter.js";
import { PullTenantsTabPresenter } from "./PullTenantsTabPresenter.js";

interface PullTenantsTabExports {
  presenter: Abstraction.Interface;
}

export const PullTenantsTabFeature = createFeature<void, PullTenantsTabExports>({
  name: "Ui/PullTenantsTabFeature",
  dependencies: [
    SyncLogsFeature,
    TenantsFeature,
    NotificationsFeature,
    URLListStateFeature,
    EventsFeature,
  ],
  register(container) {
    container.register(PullTenantsTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
