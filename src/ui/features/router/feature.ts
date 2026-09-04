import { createFeature } from "~/ui/di/createFeature.js";
import { RouteRegistry } from "./RouteRegistry.js";

export const RouterFeature = createFeature({
  name: "Ui/RouterFeature",
  register(container) {
    container.register(RouteRegistry).inSingletonScope();
  },
});
