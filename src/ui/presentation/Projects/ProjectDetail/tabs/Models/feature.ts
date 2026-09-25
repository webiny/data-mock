import { createFeature } from "~/ui/di/createFeature.js";
import { ModelsFeature } from "~/ui/features/models/feature.js";
import { TenantsFeature } from "~/ui/features/tenants/feature.js";
import { NotificationsFeature } from "~/ui/features/notifications/feature.js";
import { EventsFeature } from "~/ui/infrastructure/events/feature.js";
import { ModelsTabPresenter as Abstraction } from "./abstractions/ModelsTabPresenter.js";
import { ModelsTabPresenter } from "./ModelsTabPresenter.js";

interface ModelsTabExports {
  presenter: Abstraction.Interface;
}

export const ModelsTabFeature = createFeature<void, ModelsTabExports>({
  name: "Ui/ModelsTabFeature",
  dependencies: [ModelsFeature, TenantsFeature, NotificationsFeature, EventsFeature],
  register(container) {
    container.register(ModelsTabPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
