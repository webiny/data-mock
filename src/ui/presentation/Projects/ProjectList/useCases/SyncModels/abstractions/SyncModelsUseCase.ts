import { createAbstraction } from "@webiny/stdlib";

export interface ISyncModelsUseCase {
  execute(projectId: string): Promise<void>;
}

export const SyncModelsUseCase = createAbstraction<ISyncModelsUseCase>(
  "Ui/ProjectList/SyncModelsUseCase",
);

export namespace SyncModelsUseCase {
  export type Interface = ISyncModelsUseCase;
}
