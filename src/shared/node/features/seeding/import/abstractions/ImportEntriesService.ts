import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  GraphQLRequestError,
  SeedingError,
} from "~/shared/errors.js";

export interface IImportEntriesServiceInput {
  projectId: string;
  tenant: string;
  models: string[];
  onProgress?: ((percent: number, label: string) => void) | undefined;
}

export interface IImportEntriesServiceOutput {
  imported: number;
  models: Array<{ modelId: string; count: number }>;
}

export interface IImportEntriesService {
  execute(
    input: ImportEntriesService.Input,
  ): Promise<Result<ImportEntriesService.Output, ImportEntriesService.Error>>;
}

export const ImportEntriesService = createAbstraction<IImportEntriesService>(
  "Seeding/ImportEntriesService",
);

export namespace ImportEntriesService {
  export type Interface = IImportEntriesService;
  export type Input = IImportEntriesServiceInput;
  export type Output = IImportEntriesServiceOutput;
  export type Error =
    | ProjectNotFoundError
    | ProjectPersistenceError
    | GraphQLRequestError
    | SeedingError;
}
