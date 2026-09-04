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
  export type Input = {
    name: string;
    apiUrl: string;
    apiToken: string;
    tenant?: string;
  };
}
