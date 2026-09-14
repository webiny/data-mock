import { createFeature } from "@webiny/stdlib";
import { DeletionImpactService } from "./impact/DeletionImpactService.js";

export const DeletionFeature = createFeature({
  name: "Shared/DeletionFeature",
  register(container) {
    container.register(DeletionImpactService).inSingletonScope();
  },
});
