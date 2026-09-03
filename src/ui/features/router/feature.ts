import { createFeature } from "@webiny/stdlib";
import { Router } from "./Router.js";

export const RouterFeature = createFeature({
  name: "Ui/RouterFeature",
  register(container) {
    container.register(Router).inSingletonScope();
  },
});
