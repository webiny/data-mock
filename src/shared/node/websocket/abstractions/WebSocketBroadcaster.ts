import { createAbstraction } from "@webiny/stdlib";
import type { WSEventMap, WSEventType } from "~/shared/websocket/types.js";

export interface IWebSocketBroadcaster {
  broadcast<T extends WSEventType>(type: T, data: WSEventMap[T]): void;
}

export const WebSocketBroadcaster = createAbstraction<IWebSocketBroadcaster>(
  "Shared/WebSocketBroadcaster",
);

export namespace WebSocketBroadcaster {
  export type Interface = IWebSocketBroadcaster;
  export type EventMap = WSEventMap;
  export type EventType = WSEventType;
}
