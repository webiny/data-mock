import { createAbstraction } from "@webiny/stdlib";

import type { EnvironmentRef } from "~/shared/types.js";
export interface ISyncTenantsUseCase {
  execute(ref: EnvironmentRef): Promise<void>;
}

export const SyncTenantsUseCase = createAbstraction<ISyncTenantsUseCase>("Ui/SyncTenantsUseCase");

export namespace SyncTenantsUseCase {
  export type Interface = ISyncTenantsUseCase;
}
