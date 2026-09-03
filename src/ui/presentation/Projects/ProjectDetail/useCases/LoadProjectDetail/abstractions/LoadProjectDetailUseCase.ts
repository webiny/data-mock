import { createAbstraction } from "@webiny/stdlib";

export interface ILoadProjectDetailUseCase {
  execute(input: { projectId: string }): Promise<void>;
}

export const LoadProjectDetailUseCase = createAbstraction<ILoadProjectDetailUseCase>(
  "Ui/LoadProjectDetailUseCase",
);

export namespace LoadProjectDetailUseCase {
  export type Interface = ILoadProjectDetailUseCase;
}
