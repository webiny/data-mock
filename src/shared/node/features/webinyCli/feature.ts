import { createFeature } from "@webiny/stdlib";
import { WebinyProjectDetector } from "./detect/WebinyProjectDetector.js";
import { PulumiCheckpointReader } from "./checkpoint/PulumiCheckpointReader.js";
import { SyncSystemService } from "./sync/SyncSystemService.js";
import { SyncScheduler } from "./schedule/SyncScheduler.js";
import { WebinyCliRunner } from "./runner/WebinyCliRunner.js";
import { RefreshEnvironmentStacksService } from "./sync/refresh/RefreshEnvironmentStacksService.js";
import { WebinyDeploymentService } from "./deployment/WebinyDeploymentService.js";
import { RemoteStackOutputReader } from "./remote/RemoteStackOutputReader.js";

export const WebinyCliFeature = createFeature({
  name: "Shared/WebinyCliFeature",
  register(container) {
    container.register(WebinyProjectDetector).inSingletonScope();
    container.register(PulumiCheckpointReader).inSingletonScope();
    container.register(SyncSystemService).inSingletonScope();
    container.register(SyncScheduler).inSingletonScope();
    container.register(WebinyCliRunner).inSingletonScope();
    container.register(RefreshEnvironmentStacksService).inSingletonScope();
    container.register(WebinyDeploymentService).inSingletonScope();
    container.register(RemoteStackOutputReader).inSingletonScope();
  },
});
