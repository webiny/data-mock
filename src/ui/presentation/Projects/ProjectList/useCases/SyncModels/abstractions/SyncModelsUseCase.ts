import { createAbstraction } from "@webiny/stdlib";

import type { EnvironmentRef } from "~/shared/types.js";
export interface ISyncModelsUseCase {
  execute(ref: EnvironmentRef): Promise<void>;
}

export const SyncModelsUseCase = createAbstraction<ISyncModelsUseCase>(
  "Ui/ProjectList/SyncModelsUseCase",
);

export namespace SyncModelsUseCase {
  export type Interface = ISyncModelsUseCase;
}
