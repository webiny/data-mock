import { createFeature } from "~/ui/di/createFeature.js";
import { JobsFeature } from "~/ui/features/jobs/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { URLListStateFeature } from "~/ui/features/router/URLListStateFeature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { ActivityPresenter } from "./ActivityPresenter.js";
import { ActivityPresenter as Abstraction } from "./abstractions/ActivityPresenter.js";

interface ActivityExports {
  presenter: Abstraction.Interface;
}

export const ActivityPresentationFeature = createFeature<void, ActivityExports>({
  name: "Ui/ActivityPresentationFeature",
  dependencies: [JobsFeature, NotificationsFeature, URLListStateFeature, EventsFeature],
  register(container) {
    container.register(ActivityPresenter).inSingletonScope();
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
