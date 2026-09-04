import { createFeature } from "~/ui/di/createFeature.js";
import { LocalFilesFeature } from "~/ui/features/localFiles/feature.js";
import { FileManagerPresenter } from "./FileManagerPresenter.js";
import { FileManagerPresenter as Abstraction } from "./abstractions/FileManagerPresenter.js";

interface FileManagerExports {
  presenter: Abstraction.Interface;
}

export const FileManagerPresentationFeature = createFeature<void, FileManagerExports>({
  name: "Ui/FileManagerPresentationFeature",
  dependencies: [LocalFilesFeature],
  register(container) {
    container.register(FileManagerPresenter);
  },
  resolve(container) {
    return { presenter: container.resolve(Abstraction) };
  },
});
