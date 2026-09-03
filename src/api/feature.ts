import { createFeature } from "@webiny/stdlib";

export const ApiFeature = createFeature({
  name: "Api/ApiFeature",
  register() {
    // API-only bindings go here. Cross-layer bindings (e.g. project use cases)
    // are registered by AppFeature (~/shared/node/feature.js).
  },
});
