import type {
  ApiGraphQLResult,
  ApiGraphQLResultJson,
  ApiPath,
  GenericRecord,
} from "../abstractions/GraphQLClient.js";

export interface IGraphQLOperation<TInput = void, TOutput = unknown> {
  readonly name: string;
  readonly query: string;
  readonly path: ApiPath;
  getResult(json: ApiGraphQLResultJson): ApiGraphQLResult<TOutput>;
  getVariables?(input: TInput): GenericRecord;
}
