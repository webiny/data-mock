import { createAbstraction } from "@webiny/stdlib";
import type { IEndpointClient } from "./EndpointClient.js";

export const CmsReadEndpointClient = createAbstraction<IEndpointClient>(
  "GraphQL/CmsReadEndpointClient",
);

export namespace CmsReadEndpointClient {
  export type Interface = IEndpointClient;
}
