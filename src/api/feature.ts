import { createFeature } from "@webiny/stdlib";
import { ProjectRepositoryFeature } from "~/shared/features/ProjectRepositoryFeature.js";

export const ApiFeature = createFeature({
  name: "Api/ApiFeature",
  register(container) {
    ProjectRepositoryFeature.register(container);
  },
});
