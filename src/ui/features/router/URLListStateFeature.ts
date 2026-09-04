import { createFeature } from "@webiny/stdlib";
import { URLListStateFactory } from "./URLListStateFactory.js";

export const URLListStateFeature = createFeature({
  name: "Ui/URLListStateFeature",
  register(container): void {
    container.register(URLListStateFactory).inSingletonScope();
  },
});
