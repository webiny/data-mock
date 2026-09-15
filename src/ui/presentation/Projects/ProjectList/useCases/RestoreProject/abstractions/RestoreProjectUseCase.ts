import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IRestoreProjectUseCase {
  execute(id: string): Promise<Result<void, HTTPError>>;
}

export const RestoreProjectUseCase = createAbstraction<IRestoreProjectUseCase>(
  "Ui/RestoreProjectUseCase",
);

export namespace RestoreProjectUseCase {
  export type Interface = IRestoreProjectUseCase;
}
