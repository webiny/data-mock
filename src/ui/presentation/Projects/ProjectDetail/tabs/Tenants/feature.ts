import { createFeature } from "~/ui/di/createFeature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { TenantsTabPresenter as Abstraction } from "./abstractions/TenantsTabPresenter.js";
import { TenantsTabPresenter } from "./TenantsTabPresenter.js";

interface TenantsTabExports {
  presenter: Abstraction.Interface;
}

export const TenantsTabFeature = createFeature<void, TenantsTabExports>({
  name: "Ui/TenantsTabFeature",
  dependencies: [TenantsFeature, NotificationsFeature, EventsFeature],
  register(container) {
    container.register(TenantsTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
