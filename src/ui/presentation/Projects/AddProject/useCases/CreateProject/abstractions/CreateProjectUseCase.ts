import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { Project } from "~/shared/types.js";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ICreateProjectUseCase {
  execute(input: CreateProjectUseCase.Input): Promise<Result<Project, HTTPError>>;
}

export const CreateProjectUseCase =
  createAbstraction<ICreateProjectUseCase>("Ui/CreateProjectUseCase");

export namespace CreateProjectUseCase {
  export type Interface = ICreateProjectUseCase;
  /** Mirrors the API create body: a system on disk, or a remote-only connection. */
  export type Input = {
    name: string;
    rootPath?: string | undefined;
    operationsVersion?: string | undefined;
    awsProfile?: string | undefined;
    awsRegion?: string | undefined;
    env?: string | undefined;
    apiUrl?: string | undefined;
    apiToken?: string | undefined;
    tenant?: string | undefined;
  };
}
