import { createFeature } from "~/ui/di/createFeature.js";
import { WebSocketListener } from "./WebSocketListener.js";
import { WebSocketListener as WebSocketListenerAbstraction } from "./abstractions/WebSocketListener.js";

export const WebSocketFeature = createFeature({
  name: "Ui/WebSocketFeature",
  register(container) {
    container.register(WebSocketListener).inSingletonScope();
    const listener = container.resolve(WebSocketListenerAbstraction);
    listener.connect();
  },
});
