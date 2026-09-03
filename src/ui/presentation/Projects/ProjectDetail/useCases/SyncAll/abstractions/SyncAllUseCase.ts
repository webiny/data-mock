import { createAbstraction } from "@webiny/stdlib";

export interface ISyncAllResult {
  tenants: boolean;
  models: boolean;
  errors: string[];
}

export interface ISyncAllUseCase {
  execute(input: { projectId: string }): Promise<ISyncAllResult>;
}

export const SyncAllUseCase = createAbstraction<ISyncAllUseCase>("Ui/SyncAllUseCase");

export namespace SyncAllUseCase {
  export type Interface = ISyncAllUseCase;
  export type Result = ISyncAllResult;
}
