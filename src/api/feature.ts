import { createFeature } from "@webiny/stdlib";
import { ProjectsApiFeature } from "./features/projects/feature.js";

export const ApiFeature = createFeature({
  name: "Api/ApiFeature",
  register(container) {
    ProjectsApiFeature.register(container);
  },
});
