import { createFeature } from "@webiny/stdlib";
import { DirectoryBrowser } from "./browse/DirectoryBrowser.js";
import { ProjectScanner } from "./scan/ProjectScanner.js";

export const FileSystemFeature = createFeature({
  name: "Shared/FileSystemFeature",
  register(container) {
    container.register(DirectoryBrowser).inSingletonScope();
    container.register(ProjectScanner).inSingletonScope();
  },
});
