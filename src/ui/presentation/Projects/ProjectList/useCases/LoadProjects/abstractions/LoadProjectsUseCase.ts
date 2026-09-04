import { createAbstraction } from "@webiny/stdlib";

export interface ILoadProjectsUseCase {
  execute(): Promise<void>;
}

export const LoadProjectsUseCase =
  createAbstraction<ILoadProjectsUseCase>("Ui/LoadProjectsUseCase");

export namespace LoadProjectsUseCase {
  export type Interface = ILoadProjectsUseCase;
}
