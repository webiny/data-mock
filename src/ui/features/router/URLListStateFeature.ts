import { createFeature } from "~/ui/di/createFeature.js";
import { URLListStateFactory } from "./URLListStateFactory.js";

export const URLListStateFeature = createFeature({
  name: "Ui/URLListStateFeature",
  register(container): void {
    container.register(URLListStateFactory).inSingletonScope();
  },
});
