import { createAbstraction } from "@webiny/stdlib";

import type { EnvironmentRef } from "~/shared/types.js";
export interface ISyncAllResult {
  tenants: boolean;
  models: boolean;
  errors: string[];
}

export interface ISyncAllUseCase {
  execute(ref: EnvironmentRef): Promise<ISyncAllResult>;
}

export const SyncAllUseCase = createAbstraction<ISyncAllUseCase>("Ui/SyncAllUseCase");

export namespace SyncAllUseCase {
  export type Interface = ISyncAllUseCase;
  export type Result = ISyncAllResult;
}
