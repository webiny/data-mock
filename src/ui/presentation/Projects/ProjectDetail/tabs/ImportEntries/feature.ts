import { createFeature } from "~/ui/di/createFeature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { ModelsFeature } from "~/ui/features/models/feature.js";
import { SeedingFeature } from "~/ui/features/seeding/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { ImportEntriesTabPresenter as Abstraction } from "./abstractions/ImportEntriesTabPresenter.js";
import { ImportEntriesTabPresenter } from "./ImportEntriesTabPresenter.js";

interface ImportEntriesTabExports {
  presenter: Abstraction.Interface;
}

export const ImportEntriesTabFeature = createFeature<void, ImportEntriesTabExports>({
  name: "Ui/ImportEntriesTabFeature",
  dependencies: [
    TenantsFeature,
    ModelsFeature,
    SeedingFeature,
    NotificationsFeature,
    EventsFeature,
  ],
  register(container) {
    container.register(ImportEntriesTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
