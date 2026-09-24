import { createFeature } from "~/ui/di/createFeature.js";
import { SeedingFeature } from "~/ui/features/seeding/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { URLListStateFeature } from "~/ui/features/router/URLListStateFeature.js";
import { SeedHistoryTabPresenter as Abstraction } from "./abstractions/SeedHistoryTabPresenter.js";
import { SeedHistoryTabPresenter } from "./SeedHistoryTabPresenter.js";

interface SeedHistoryTabExports {
  presenter: Abstraction.Interface;
}

export const SeedHistoryTabFeature = createFeature<void, SeedHistoryTabExports>({
  name: "Ui/SeedHistoryTabFeature",
  dependencies: [SeedingFeature, NotificationsFeature, EventsFeature, URLListStateFeature],
  register(container) {
    container.register(SeedHistoryTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
