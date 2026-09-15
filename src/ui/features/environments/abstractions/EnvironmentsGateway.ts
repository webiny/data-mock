import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { DeletionImpact, Job, ProjectEnvironment, ProjectStack } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IEnvironmentsGateway {
  /** Archived environments are omitted unless `includeArchived` is set. */
  listForProject(
    projectId: string,
    includeArchived?: boolean,
  ): Promise<Result<ProjectEnvironment[], HTTPError>>;
  listStacks(projectId: string, environmentId: string): Promise<Result<ProjectStack[], HTTPError>>;
  sync(projectId: string): Promise<Result<Job, HTTPError>>;
  /** Soft delete — keeps every child row and can be undone with `restore`. */
  archive(projectId: string, environmentId: string): Promise<Result<ProjectEnvironment, HTTPError>>;
  restore(projectId: string, environmentId: string): Promise<Result<ProjectEnvironment, HTTPError>>;
  /** Irreversible: deletes the environment and every row that cascades from it. */
  purge(projectId: string, environmentId: string): Promise<Result<void, HTTPError>>;
  /** Which apps this project's Webiny version can deploy. Not the apps that have state. */
  listDeployableApps(
    projectId: string,
  ): Promise<Result<{ apps: string[]; versionMajor: number | null }, HTTPError>>;
  deploy(
    projectId: string,
    environmentId: string,
    input: { apps?: string[]; region?: string },
  ): Promise<Result<Job, HTTPError>>;
  /** `confirmProjectName` must equal the project's name; the server checks it too. */
  destroy(
    projectId: string,
    environmentId: string,
    input: { apps?: string[]; region?: string; confirmProjectName: string },
  ): Promise<Result<Job, HTTPError>>;
  /** Counts what `purge` would destroy. */
  deletionImpact(
    projectId: string,
    environmentId: string,
  ): Promise<Result<DeletionImpact, HTTPError>>;
}

export const EnvironmentsGateway =
  createAbstraction<IEnvironmentsGateway>("Ui/EnvironmentsGateway");

export namespace EnvironmentsGateway {
  export type Interface = IEnvironmentsGateway;
}
