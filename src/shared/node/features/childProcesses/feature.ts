import { createFeature } from "@webiny/stdlib";
import { ChildProcessTracker } from "./ChildProcessTracker.js";

export const ChildProcessesFeature = createFeature({
  name: "Shared/ChildProcessesFeature",
  register(container) {
    container.register(ChildProcessTracker).inSingletonScope();
  },
});
