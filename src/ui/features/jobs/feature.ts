import { createFeature } from "~/ui/di/createFeature.js";
import { JobsGateway } from "./JobsGateway.js";
import { JobsRepository } from "./JobsRepository.js";

export const JobsFeature = createFeature({
  name: "Ui/JobsFeature",
  register(container) {
    container.register(JobsGateway).inSingletonScope();
    container.register(JobsRepository).inSingletonScope();
  },
});
