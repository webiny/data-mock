import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ILoadProjectsUseCase {
  execute(): Promise<Result<void, HTTPError>>;
}

export const LoadProjectsUseCase =
  createAbstraction<ILoadProjectsUseCase>("Ui/LoadProjectsUseCase");

export namespace LoadProjectsUseCase {
  export type Interface = ILoadProjectsUseCase;
}
