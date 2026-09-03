import { createFeature } from "@webiny/stdlib";
import { FetchHttpClient } from "~/shared/FetchHttpClient.js";
import { GraphQLClient } from "./abstractions/GraphQLClient.js";
import { GraphQLClientImpl } from "./GraphQLClient.js";
import type { GraphQLClientConfig } from "./GraphQLClient.js";

interface IGraphQLFeatureContext {
  readonly url: string;
  readonly token: string;
  readonly tenant?: string;
}

export const GraphQLFeature = createFeature<IGraphQLFeatureContext>({
  name: "GraphQL/GraphQLFeature",
  register(container, context) {
    const config: GraphQLClientConfig = {
      url: context.url,
      token: context.token,
      tenant: context.tenant ?? "root",
    };
    const httpClient = new FetchHttpClient();
    const client = new GraphQLClientImpl(httpClient, config);
    container.registerInstance(GraphQLClient, client);
  },
});
