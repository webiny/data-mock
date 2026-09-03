import { createAbstraction } from "@webiny/stdlib";

export interface ISyncAllUseCase {
  execute(input: { projectId: string }): Promise<void>;
}

export const SyncAllUseCase = createAbstraction<ISyncAllUseCase>("Ui/SyncAllUseCase");

export namespace SyncAllUseCase {
  export type Interface = ISyncAllUseCase;
}
