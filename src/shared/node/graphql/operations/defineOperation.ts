import type { ZodType } from "zod";
import type { IGraphQLOperation } from "./types.js";
import type { ApiPath, GenericRecord } from "../abstractions/GraphQLClient.js";
import { parseOperationResponse } from "./parseOperationResponse.js";

interface DefineOperationParams<TInput, TData, TOutput> {
  name: string;
  path: ApiPath;
  query: string;
  responseKey: string;
  dataSchema: ZodType<TData>;
  transform?: (data: TData) => TOutput;
  getVariables?: (input: TInput) => GenericRecord;
}

export function defineOperation<TInput = void, TData = unknown, TOutput = TData>(
  params: DefineOperationParams<TInput, TData, TOutput>,
): IGraphQLOperation<TInput, TOutput> {
  return {
    name: params.name,
    path: params.path,
    query: params.query,
    getResult(json) {
      return parseOperationResponse(json, params.responseKey, params.dataSchema, params.transform);
    },
    ...(params.getVariables ? { getVariables: params.getVariables } : {}),
  };
}
