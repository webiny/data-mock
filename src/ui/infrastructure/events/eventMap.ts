import type { WSEventMap } from "~/shared/websocket/types.js";

declare module "./abstractions/EventBridge.js" {
  interface IEventMap extends WSEventMap {
    "ws:reconnected": undefined;
  }
}
