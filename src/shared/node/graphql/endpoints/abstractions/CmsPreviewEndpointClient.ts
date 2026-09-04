import { createAbstraction } from "@webiny/stdlib";
import type { IEndpointClient } from "./EndpointClient.js";

export const CmsPreviewEndpointClient = createAbstraction<IEndpointClient>(
  "GraphQL/CmsPreviewEndpointClient",
);

export namespace CmsPreviewEndpointClient {
  export type Interface = IEndpointClient;
}
