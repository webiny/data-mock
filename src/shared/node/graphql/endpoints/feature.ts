import { createFeature } from "@webiny/stdlib";
import { HttpClient } from "~/shared/abstractions/HttpClient.js";
import { CmsManageEndpointClient } from "./abstractions/CmsManageEndpointClient.js";
import { CmsReadEndpointClient } from "./abstractions/CmsReadEndpointClient.js";
import { CmsPreviewEndpointClient } from "./abstractions/CmsPreviewEndpointClient.js";
import { GraphQLEndpointClient } from "./abstractions/GraphQLEndpointClient.js";
import { createEndpointClient } from "./createEndpointClient.js";

export const EndpointsFeature = createFeature({
  name: "GraphQL/EndpointsFeature",
  register(container) {
    const httpClient = container.resolve(HttpClient);

    container.registerInstance(
      CmsManageEndpointClient,
      createEndpointClient(httpClient, "/cms/manage"),
    );
    container.registerInstance(
      CmsReadEndpointClient,
      createEndpointClient(httpClient, "/cms/read"),
    );
    container.registerInstance(
      CmsPreviewEndpointClient,
      createEndpointClient(httpClient, "/cms/preview"),
    );
    container.registerInstance(GraphQLEndpointClient, createEndpointClient(httpClient, "/graphql"));
  },
});
