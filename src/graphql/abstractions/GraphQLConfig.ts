import { createAbstraction } from "@webiny/stdlib";

export interface IGraphQLConfig {
  readonly url: string;
  readonly token: string;
  readonly tenant: string;
  readonly retries: number;
  readonly retryMinTimeout: number;
}

export const GraphQLConfig = createAbstraction<IGraphQLConfig>("GraphQL/Config");

export namespace GraphQLConfig {
  export type Interface = IGraphQLConfig;
}
