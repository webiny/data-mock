import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type {
  ProjectNotFoundError,
  GraphQLRequestError,
  ProjectPersistenceError,
} from "~/shared/errors.js";

export interface IPushModelsInput {
  projectId: string;
}

export interface IPushModelsOutput {
  pushed: { groups: number; models: number };
  skipped: { groups: number; models: number };
}

export interface IPushModelsService {
  execute(
    input: PushModelsService.Input,
  ): Promise<Result<PushModelsService.Output, PushModelsService.Error>>;
}

export const PushModelsService = createAbstraction<IPushModelsService>("Models/PushModelsService");

export namespace PushModelsService {
  export type Interface = IPushModelsService;
  export type Input = IPushModelsInput;
  export type Output = IPushModelsOutput;
  export type Error = ProjectNotFoundError | GraphQLRequestError | ProjectPersistenceError;
}
