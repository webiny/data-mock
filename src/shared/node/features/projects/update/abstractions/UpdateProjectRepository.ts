import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project, SyncStatus, VersionSource } from "~/shared/types.js";
import type {
  ProjectNotFoundError,
  ProjectPersistenceError,
  ValidationError,
} from "~/shared/errors.js";

export interface IUpdateProjectRepositoryInput {
  id: string;
  name?: string;
  rootPath?: string | null;
  webinyVersion?: string | null;
  versionSource?: VersionSource | null;
  versionMajor?: number | null;
  operationsVersion?: string;
  pulumiBackend?: string | null;
  awsProfile?: string | null;
  awsRegion?: string | null;
  lastSyncedAt?: number | null;
  lastSyncStatus?: SyncStatus | null;
}

export interface IUpdateProjectRepository {
  execute(
    input: UpdateProjectRepository.Input,
  ): Promise<Result<Project, UpdateProjectRepository.Error>>;
}

export const UpdateProjectRepository = createAbstraction<IUpdateProjectRepository>(
  "Projects/UpdateProjectRepository",
);

export namespace UpdateProjectRepository {
  export type Interface = IUpdateProjectRepository;
  export type Input = IUpdateProjectRepositoryInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError | ValidationError;
}
