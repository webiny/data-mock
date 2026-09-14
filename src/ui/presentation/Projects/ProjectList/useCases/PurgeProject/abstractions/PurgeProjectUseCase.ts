import { createAbstraction } from "@webiny/stdlib";

export interface IPurgeProjectUseCase {
  execute(id: string): Promise<void>;
}

export const PurgeProjectUseCase =
  createAbstraction<IPurgeProjectUseCase>("Ui/PurgeProjectUseCase");

export namespace PurgeProjectUseCase {
  export type Interface = IPurgeProjectUseCase;
}
