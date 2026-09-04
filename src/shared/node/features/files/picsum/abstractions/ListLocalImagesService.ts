import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ILocalImageFile {
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export type IListLocalImagesServiceInput = Record<string, never>;

export interface IListLocalImagesServiceOutput {
  files: ILocalImageFile[];
}

export interface IListLocalImagesService {
  execute(
    input: ListLocalImagesService.Input,
  ): Promise<Result<ListLocalImagesService.Output, ListLocalImagesService.Error>>;
}

export const ListLocalImagesService = createAbstraction<IListLocalImagesService>(
  "Files/ListLocalImagesService",
);

export namespace ListLocalImagesService {
  export type Interface = IListLocalImagesService;
  export type Input = IListLocalImagesServiceInput;
  export type Output = IListLocalImagesServiceOutput;
  export type Error = ProjectPersistenceError;
  export type LocalImageFile = ILocalImageFile;
}
