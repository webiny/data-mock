import { createAbstraction } from "@webiny/stdlib";
import type { IGraphQLOperation } from "../types.js";

export interface IOperationRegistry {
  register(version: string, operation: IGraphQLOperation<unknown, unknown>): void;
  resolve<TInput = void, TOutput = unknown>(
    name: string,
    version: string,
  ): IGraphQLOperation<TInput, TOutput>;
}

export const OperationRegistry = createAbstraction<IOperationRegistry>("GraphQL/OperationRegistry");

export namespace OperationRegistry {
  export type Interface = IOperationRegistry;
}
