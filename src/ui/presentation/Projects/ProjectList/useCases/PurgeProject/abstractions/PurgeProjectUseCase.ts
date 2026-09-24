import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IPurgeProjectUseCase {
  execute(id: string): Promise<Result<void, HTTPError>>;
}

export const PurgeProjectUseCase =
  createAbstraction<IPurgeProjectUseCase>("Ui/PurgeProjectUseCase");

export namespace PurgeProjectUseCase {
  export type Interface = IPurgeProjectUseCase;
}
