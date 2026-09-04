import { createFeature } from "@webiny/stdlib";
import { WebSocketBroadcaster } from "~/shared/node/websocket/abstractions/WebSocketBroadcaster.js";
import {
  FastifyWebSocketBroadcaster,
  FastifyWebSocketBroadcasterToken,
} from "./WebSocketBroadcaster.js";

export const WebSocketFeature = createFeature({
  name: "Api/WebSocketFeature",
  register(container) {
    const broadcaster = new FastifyWebSocketBroadcaster();
    container.registerInstance(WebSocketBroadcaster, broadcaster);
    container.registerInstance(FastifyWebSocketBroadcasterToken, broadcaster);
  },
});
