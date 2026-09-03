import { createFeature } from "@webiny/stdlib";

export const ApiFeature = createFeature({
  name: "Api/ApiFeature",
  register() {
    // Route-level features will be registered here as they are added.
    // ProjectRepositoryFeature is registered in AppFeature (shared concern).
  },
});
