import { createAbstraction } from "@webiny/stdlib";
import type { Result } from "@webiny/stdlib";
import type { GraphQLRequestError } from "~/shared/errors.js";

export type GenericRecord = Record<string, unknown>;

export type ApiPath = "/cms/manage" | "/graphql";

export interface ApiCmsMeta {
  totalCount: number;
  hasMoreItems: boolean;
  cursor: string | null;
}

export interface ApiGraphQLSuccessResult<T> {
  data: T;
  meta?: ApiCmsMeta | null;
  error?: never;
  extensions?: GenericRecord[];
}

export interface ApiGraphQLErrorResult {
  data?: never | null;
  error: { message: string; code: string; data?: GenericRecord | null };
  extensions?: GenericRecord[];
}

export type ApiGraphQLResult<T> = ApiGraphQLSuccessResult<T> | ApiGraphQLErrorResult;

export interface ApiGraphQLResultJson {
  data: GenericRecord;
  meta?: ApiCmsMeta;
  errors?: GenericRecord[];
  extensions?: GenericRecord[];
}

export interface ResultExtractor<T> {
  (json: ApiGraphQLResultJson): ApiGraphQLResult<T>;
}

export interface QueryParams<T> {
  query: string;
  path: ApiPath;
  variables?: GenericRecord;
  getResult: ResultExtractor<T>;
}

export interface MutationParams<T> {
  mutation: string;
  path: ApiPath;
  variables: GenericRecord;
  getResult: ResultExtractor<T>;
}

export interface BatchMutationParams<T> {
  mutation: string;
  path: ApiPath;
  variables: GenericRecord[];
  getResult: ResultExtractor<T>;
  atOnce?: number;
}

export interface IGraphQLClient {
  setTenant(tenant: string): void;
  query<T>(params: QueryParams<T>): Promise<Result<ApiGraphQLResult<T>, GraphQLRequestError>>;
  mutation<T>(params: MutationParams<T>): Promise<Result<ApiGraphQLResult<T>, GraphQLRequestError>>;
  mutations<T>(
    params: BatchMutationParams<T>,
  ): Promise<Result<ApiGraphQLResult<T>[], GraphQLRequestError>>;
}

export const GraphQLClient = createAbstraction<IGraphQLClient>("GraphQL/Client");

export namespace GraphQLClient {
  export type Interface = IGraphQLClient;
  export type Query<T> = QueryParams<T>;
  export type Mutation<T> = MutationParams<T>;
  export type BatchMutation<T> = BatchMutationParams<T>;
  export type GQLResult<T> = ApiGraphQLResult<T>;
  export type ResultJson = ApiGraphQLResultJson;
  export type Extractor<T> = ResultExtractor<T>;
}
