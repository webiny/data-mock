import { createFeature } from "@webiny/stdlib";
import { UploadFileRepository } from "./upload/UploadFileRepository.js";
import { FileUploadService } from "./upload/FileUploadService.js";
import { ListProjectFilesRepository } from "./list/ListProjectFilesRepository.js";
import { DeleteProjectFileRepository } from "./delete/DeleteProjectFileRepository.js";
import { PullPicsumImagesService } from "./picsum/PullPicsumImagesService.js";
import { ListLocalImagesService } from "./picsum/ListLocalImagesService.js";
import { SyncProjectFilesRepository } from "./sync/SyncProjectFilesRepository.js";
import { SyncFilesService } from "./sync/SyncFilesService.js";
import { LoadFilePoolService } from "./pool/LoadFilePoolService.js";

export const FilesFeature = createFeature({
  name: "Shared/FilesFeature",
  register(container) {
    container.register(UploadFileRepository).inSingletonScope();
    container.register(ListProjectFilesRepository).inSingletonScope();
    container.register(DeleteProjectFileRepository).inSingletonScope();
    container.register(FileUploadService);
    container.register(PullPicsumImagesService).inSingletonScope();
    container.register(ListLocalImagesService).inSingletonScope();
    container.register(SyncProjectFilesRepository).inSingletonScope();
    container.register(SyncFilesService);
    container.register(LoadFilePoolService);
  },
});
