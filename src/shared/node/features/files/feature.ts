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
import { UploadGlobalFilesToProjectService } from "./pool/UploadGlobalFilesToProjectService.js";
import { ListLocalFilesService } from "./local/ListLocalFilesService.js";
import { SaveLocalFileService } from "./local/SaveLocalFileService.js";
import { DeleteLocalFileService } from "./local/DeleteLocalFileService.js";

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
    container.register(UploadGlobalFilesToProjectService);
    container.register(ListLocalFilesService).inSingletonScope();
    container.register(SaveLocalFileService).inSingletonScope();
    container.register(DeleteLocalFileService).inSingletonScope();
  },
});
