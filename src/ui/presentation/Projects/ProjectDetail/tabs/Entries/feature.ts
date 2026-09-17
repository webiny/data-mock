import { createFeature } from "~/ui/di/createFeature.js";
import { EntriesFeature } from "~/ui/features/entries/feature.js";
import { ModelsFeature } from "~/ui/features/models/feature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { URLListStateFeature } from "~/ui/features/router/URLListStateFeature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { EntriesTabPresenter as Abstraction } from "./abstractions/EntriesTabPresenter.js";
import { EntriesTabPresenter } from "./EntriesTabPresenter.js";

interface EntriesTabExports {
  presenter: Abstraction.Interface;
}

export const EntriesTabFeature = createFeature<void, EntriesTabExports>({
  name: "Ui/EntriesTabFeature",
  dependencies: [
    EntriesFeature,
    ModelsFeature,
    TenantsFeature,
    NotificationsFeature,
    URLListStateFeature,
    EventsFeature,
  ],
  register(container) {
    container.register(EntriesTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
