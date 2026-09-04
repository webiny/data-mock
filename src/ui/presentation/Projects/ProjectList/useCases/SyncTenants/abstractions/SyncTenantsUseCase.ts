import { createAbstraction } from "@webiny/stdlib";

export interface ISyncTenantsUseCase {
  execute(projectId: string): Promise<void>;
}

export const SyncTenantsUseCase = createAbstraction<ISyncTenantsUseCase>("Ui/SyncTenantsUseCase");

export namespace SyncTenantsUseCase {
  export type Interface = ISyncTenantsUseCase;
}
