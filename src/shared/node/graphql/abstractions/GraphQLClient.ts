/**
 * The shapes a Webiny GraphQL response comes back in.
 *
 * Types only. The client that once used them was registered by nothing and resolved by
 * nothing but its own test; the endpoint clients talk to `HttpClient` directly.
 */
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
  data: GenericRecord | null;
  meta?: ApiCmsMeta;
  errors?: GenericRecord[];
  extensions?: GenericRecord[];
}
