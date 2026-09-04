import { createAbstraction } from "@webiny/stdlib";

export interface IDeleteProjectUseCase {
  execute(id: string): Promise<void>;
}

export const DeleteProjectUseCase =
  createAbstraction<IDeleteProjectUseCase>("Ui/DeleteProjectUseCase");

export namespace DeleteProjectUseCase {
  export type Interface = IDeleteProjectUseCase;
}
