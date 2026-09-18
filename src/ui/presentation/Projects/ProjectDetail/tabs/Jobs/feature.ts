import { createFeature } from "~/ui/di/createFeature.js";
import { JobsFeature } from "~/ui/features/jobs/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { URLListStateFeature } from "~/ui/features/router/URLListStateFeature.js";
import { JobsTabPresenter as Abstraction } from "./abstractions/JobsTabPresenter.js";
import { JobsTabPresenter } from "./JobsTabPresenter.js";

interface JobsTabExports {
  presenter: Abstraction.Interface;
}

export const JobsTabFeature = createFeature<void, JobsTabExports>({
  name: "Ui/JobsTabFeature",
  dependencies: [JobsFeature, NotificationsFeature, EventsFeature, URLListStateFeature],
  register(container) {
    container.register(JobsTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
