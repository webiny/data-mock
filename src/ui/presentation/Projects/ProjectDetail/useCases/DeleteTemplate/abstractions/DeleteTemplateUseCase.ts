import { createAbstraction } from "@webiny/stdlib";

export interface IDeleteTemplateUseCase {
  execute(input: { projectId: string; templateId: string }): Promise<void>;
}

export const DeleteTemplateUseCase = createAbstraction<IDeleteTemplateUseCase>(
  "Ui/DeleteTemplateUseCase",
);

export namespace DeleteTemplateUseCase {
  export type Interface = IDeleteTemplateUseCase;
}
