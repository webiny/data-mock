import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectGroup } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ISyncProjectGroupsRepositoryInput {
  projectId: string;
  groups: Array<{
    slug: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    remoteId?: string;
  }>;
}

export interface ISyncProjectGroupsRepository {
  execute(
    input: SyncProjectGroupsRepository.Input,
  ): Promise<Result<ProjectGroup[], SyncProjectGroupsRepository.Error>>;
}

export const SyncProjectGroupsRepository = createAbstraction<ISyncProjectGroupsRepository>(
  "Models/SyncProjectGroupsRepository",
);

export namespace SyncProjectGroupsRepository {
  export type Interface = ISyncProjectGroupsRepository;
  export type Input = ISyncProjectGroupsRepositoryInput;
  export type Error = ProjectPersistenceError;
}
