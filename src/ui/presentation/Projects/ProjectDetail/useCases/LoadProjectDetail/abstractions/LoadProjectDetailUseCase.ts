import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface ILoadProjectDetailUseCase {
  execute(input: { projectId: string }): Promise<Result<void, HTTPError>>;
}

export const LoadProjectDetailUseCase = createAbstraction<ILoadProjectDetailUseCase>(
  "Ui/LoadProjectDetailUseCase",
);

export namespace LoadProjectDetailUseCase {
  export type Interface = ILoadProjectDetailUseCase;
}
