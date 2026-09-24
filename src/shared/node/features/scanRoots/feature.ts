import { createFeature } from "@webiny/stdlib";
import { CreateScanRootRepository } from "./create/CreateScanRootRepository.js";
import { ListScanRootsRepository } from "./list/ListScanRootsRepository.js";
import { RemoveScanRootRepository } from "./remove/RemoveScanRootRepository.js";

export const ScanRootsFeature = createFeature({
  name: "Shared/ScanRootsFeature",
  register(container) {
    container.register(CreateScanRootRepository).inSingletonScope();
    container.register(ListScanRootsRepository).inSingletonScope();
    container.register(RemoveScanRootRepository).inSingletonScope();
  },
});
