import { createAbstraction } from "@webiny/stdlib";
import type { IEndpointClient } from "./EndpointClient.js";

export const GraphQLEndpointClient = createAbstraction<IEndpointClient>(
  "GraphQL/GraphQLEndpointClient",
);

export namespace GraphQLEndpointClient {
  export type Interface = IEndpointClient;
}
