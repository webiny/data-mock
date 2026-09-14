import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { ProjectPersistenceError } from "~/shared/errors.js";

export interface ICreateProjectRepositoryInput {
  name: string;
  /** Absolute path to a Webiny checkout. Null for a remote-only project. */
  rootPath?: string | null;
  /** Detected version — display only, and legitimately absent for a workspace root. */
  webinyVersion?: string | null;
  versionSource?: string | null;
  versionMajor?: number | null;
  /** Drives the GraphQL operation registry. Never null, never "0.0.0". */
  operationsVersion?: string;
  pulumiBackend?: string | null;
  awsProfile?: string | null;
  awsRegion?: string | null;
}

export interface ICreateProjectRepository {
  execute(
    input: CreateProjectRepository.Input,
  ): Promise<Result<Project, CreateProjectRepository.Error>>;
}

export const CreateProjectRepository = createAbstraction<ICreateProjectRepository>(
  "Projects/CreateProjectRepository",
);

export namespace CreateProjectRepository {
  export type Interface = ICreateProjectRepository;
  export type Input = ICreateProjectRepositoryInput;
  export type Error = ProjectPersistenceError;
}
