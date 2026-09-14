import { createAbstraction } from "@webiny/stdlib";

export interface IRestoreProjectUseCase {
  execute(id: string): Promise<void>;
}

export const RestoreProjectUseCase = createAbstraction<IRestoreProjectUseCase>(
  "Ui/RestoreProjectUseCase",
);

export namespace RestoreProjectUseCase {
  export type Interface = IRestoreProjectUseCase;
}
