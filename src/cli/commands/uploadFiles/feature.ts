import { createFeature } from "@webiny/stdlib";
import { UploadFilesCommand } from "./UploadFilesCommand.js";

export const UploadFilesFeature = createFeature({
  name: "Cli/UploadFilesFeature",
  register(container) {
    container.register(UploadFilesCommand).inSingletonScope();
  },
});
