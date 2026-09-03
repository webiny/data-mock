import { createFeature } from "@webiny/stdlib";
import { RouteRegistry } from "./RouteRegistry.js";

export const RouterFeature = createFeature({
  name: "Ui/RouterFeature",
  register(container) {
    container.register(RouteRegistry).inSingletonScope();
  },
});
