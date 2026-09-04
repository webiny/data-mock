import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectFile } from "~/shared/types.js";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  GraphQLRequestError,
} from "~/shared/errors.js";

export interface ISyncFilesServiceInput {
  projectId: string;
  tenant: string;
}

export interface ISyncFilesServiceOutput {
  synced: number;
  files: ProjectFile[];
}

export interface ISyncFilesService {
  execute(
    input: SyncFilesService.Input,
  ): Promise<Result<SyncFilesService.Output, SyncFilesService.Error>>;
}

export const SyncFilesService = createAbstraction<ISyncFilesService>("Files/SyncFilesService");

export namespace SyncFilesService {
  export type Interface = ISyncFilesService;
  export type Input = ISyncFilesServiceInput;
  export type Output = ISyncFilesServiceOutput;
  export type Error = ProjectNotFoundError | GraphQLRequestError | ProjectPersistenceError;
}
