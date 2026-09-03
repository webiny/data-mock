import { createFeature } from "@webiny/stdlib";
import { NotificationService } from "./NotificationService.js";

export const NotificationsFeature = createFeature({
  name: "Ui/NotificationsFeature",
  register(container) {
    container.register(NotificationService).inSingletonScope();
  },
});
