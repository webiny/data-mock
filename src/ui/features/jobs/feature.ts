import { createFeature } from "~/ui/di/createFeature.js";
import { HTTPClientFeature } from "~/ui/infrastructure/httpClient/feature.js";
import { JobsGateway } from "./JobsGateway.js";
import { JobsRepository } from "./JobsRepository.js";

export const JobsFeature = createFeature({
  name: "Ui/JobsFeature",
  // Every sibling gateway feature declares this. Without it, JobsGateway resolves only because
  // main.tsx happens to register the HTTP client first — a bootstrap order, not a guarantee.
  dependencies: [HTTPClientFeature],
  register(container) {
    container.register(JobsGateway).inSingletonScope();
    container.register(JobsRepository).inSingletonScope();
  },
});
