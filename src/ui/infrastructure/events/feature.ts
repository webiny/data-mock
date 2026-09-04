import { createFeature } from "@webiny/stdlib";
import { EventBridge } from "./EventBridge.js";

export const EventsFeature = createFeature({
  name: "Ui/EventsFeature",
  register(container) {
    container.register(EventBridge).inSingletonScope();
  },
});
