import { createFeature } from "@webiny/stdlib";
import { EnvironmentHealthCache } from "./health/EnvironmentHealthCache.js";

export const ApiFeature = createFeature({
  name: "Api/ApiFeature",
  register(container) {
    container.register(EnvironmentHealthCache).inSingletonScope();
  },
});
