import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectModel, ApiCmsModelField } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ISyncProjectModelsRepositoryInput {
  projectId: string;
  models: Array<{
    groupSlug: string;
    modelId: string;
    name: string;
    singularApiName: string;
    pluralApiName: string;
    description?: string | null;
    plugin?: boolean;
    fields: ApiCmsModelField[];
    remoteId?: string;
  }>;
}

export interface ISyncProjectModelsRepository {
  execute(
    input: SyncProjectModelsRepository.Input,
  ): Promise<Result<ProjectModel[], SyncProjectModelsRepository.Error>>;
}

export const SyncProjectModelsRepository = createAbstraction<ISyncProjectModelsRepository>(
  "Models/SyncProjectModelsRepository",
);

export namespace SyncProjectModelsRepository {
  export type Interface = ISyncProjectModelsRepository;
  export type Input = ISyncProjectModelsRepositoryInput;
  export type Error = ProjectPersistenceError;
}
