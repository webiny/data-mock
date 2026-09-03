import { createAbstraction } from "@webiny/stdlib";

export interface INotificationService {
  success(message: string): void;
  error(message: string): void;
  warning(message: string): void;
  info(message: string): void;
}

export const NotificationService =
  createAbstraction<INotificationService>("Ui/NotificationService");

export namespace NotificationService {
  export type Interface = INotificationService;
}
