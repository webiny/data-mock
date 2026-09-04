import { createFeature } from "@webiny/stdlib";
import { WebSocketListener } from "./WebSocketListener.js";

export const WebSocketFeature = createFeature({
  name: "Ui/WebSocketFeature",
  register(container) {
    container.register(WebSocketListener).inSingletonScope();
  },
});
