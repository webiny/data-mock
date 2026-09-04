import { createAbstraction } from "@webiny/stdlib";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IEventMap {}

export type EventHandler<T> = (data: T) => void;

export interface IEventBridge {
  on<K extends keyof IEventMap>(type: K, handler: EventHandler<IEventMap[K]>): () => void;
  off<K extends keyof IEventMap>(type: K, handler: EventHandler<IEventMap[K]>): void;
  emit<K extends keyof IEventMap>(type: K, data: IEventMap[K]): void;
}

export const EventBridge = createAbstraction<IEventBridge>("Ui/EventBridge");

export namespace EventBridge {
  export type Interface = IEventBridge;
}
