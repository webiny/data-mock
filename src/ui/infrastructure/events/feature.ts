import { createFeature } from "~/ui/di/createFeature.js";
import { EventBridge } from "./EventBridge.js";

export const EventsFeature = createFeature({
  name: "Ui/EventsFeature",
  register(container) {
    container.register(EventBridge).inSingletonScope();
  },
});
