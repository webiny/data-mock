import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { HTTPError } from "~/ui/infrastructure/httpClient/HTTPError.js";

export interface IDeleteTemplateUseCase {
  execute(input: { projectId: string; templateId: string }): Promise<Result<void, HTTPError>>;
}

export const DeleteTemplateUseCase = createAbstraction<IDeleteTemplateUseCase>(
  "Ui/DeleteTemplateUseCase",
);

export namespace DeleteTemplateUseCase {
  export type Interface = IDeleteTemplateUseCase;
}
