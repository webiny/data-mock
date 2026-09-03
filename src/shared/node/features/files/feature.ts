import { createFeature } from "@webiny/stdlib";
import { UploadFileRepository } from "./upload/UploadFileRepository.js";
import { FileUploadService } from "./upload/FileUploadService.js";
import { ListProjectFilesRepository } from "./list/ListProjectFilesRepository.js";
import { DeleteProjectFileRepository } from "./delete/DeleteProjectFileRepository.js";

export const FilesFeature = createFeature({
  name: "Shared/FilesFeature",
  register(container) {
    container.register(UploadFileRepository).inSingletonScope();
    container.register(ListProjectFilesRepository).inSingletonScope();
    container.register(DeleteProjectFileRepository).inSingletonScope();
    container.register(FileUploadService);
  },
});
