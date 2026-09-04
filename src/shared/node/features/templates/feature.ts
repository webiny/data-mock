import { createFeature } from "@webiny/stdlib";
import { ListSeedTemplatesRepository } from "./list/ListSeedTemplatesRepository.js";
import { CreateSeedTemplateRepository } from "./create/CreateSeedTemplateRepository.js";
import { GetSeedTemplateRepository } from "./get/GetSeedTemplateRepository.js";
import { DeleteSeedTemplateRepository } from "./delete/DeleteSeedTemplateRepository.js";

export const TemplatesFeature = createFeature({
  name: "Templates/TemplatesFeature",
  register(container) {
    container.register(ListSeedTemplatesRepository).inSingletonScope();
    container.register(CreateSeedTemplateRepository).inSingletonScope();
    container.register(GetSeedTemplateRepository).inSingletonScope();
    container.register(DeleteSeedTemplateRepository).inSingletonScope();
  },
});
