import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { ProjectNotFoundError, ProjectPersistenceError } from "~/shared/errors.js";

export interface IRemoveProjectInput {
  id: string;
}

export interface IRemoveProjectUseCase {
  execute(input: RemoveProjectUseCase.Input): Promise<Result<void, RemoveProjectUseCase.Error>>;
}

export const RemoveProjectUseCase = createAbstraction<IRemoveProjectUseCase>(
  "Projects/RemoveProjectUseCase",
);

export namespace RemoveProjectUseCase {
  export type Interface = IRemoveProjectUseCase;
  export type Input = IRemoveProjectInput;
  export type Error = ProjectNotFoundError | ProjectPersistenceError;
}
