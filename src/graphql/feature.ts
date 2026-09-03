import { createFeature } from "@webiny/stdlib";
import { FetchHttpClient } from "~/shared/FetchHttpClient.js";
import { GraphQLConfig } from "./abstractions/GraphQLConfig.js";
import { GraphQLClient } from "./GraphQLClient.js";

interface IGraphQLFeatureContext {
  readonly url: string;
  readonly token: string;
  readonly tenant?: string;
  readonly retries?: number;
  readonly retryMinTimeout?: number;
}

export const GraphQLFeature = createFeature<IGraphQLFeatureContext>({
  name: "GraphQL/GraphQLFeature",
  register(container, context) {
    container.register(FetchHttpClient).inSingletonScope();

    container.registerInstance(GraphQLConfig, {
      url: context.url,
      token: context.token,
      tenant: context.tenant ?? "root",
      retries: context.retries ?? 5,
      retryMinTimeout: context.retryMinTimeout ?? 1000,
    });

    container.register(GraphQLClient).inSingletonScope();
  },
});
