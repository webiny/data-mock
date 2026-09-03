import { notifications } from "@mantine/notifications";
import { NotificationService as Abstraction } from "./abstractions/NotificationService.js";

class NotificationServiceImpl implements Abstraction.Interface {
  public success = (message: string): void => {
    notifications.show({ message, color: "green", autoClose: 4000 });
  };

  public error = (message: string): void => {
    notifications.show({ message, color: "red", autoClose: 6000 });
  };

  public warning = (message: string): void => {
    notifications.show({ message, color: "yellow", autoClose: 5000 });
  };

  public info = (message: string): void => {
    notifications.show({ message, color: "blue", autoClose: 4000 });
  };
}

export const NotificationService = Abstraction.createImplementation({
  implementation: NotificationServiceImpl,
  dependencies: [],
});
