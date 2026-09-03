import { createAbstraction } from "@webiny/stdlib";
import type { IEndpointClient } from "./EndpointClient.js";

export const CmsManageEndpointClient = createAbstraction<IEndpointClient>(
  "GraphQL/CmsManageEndpointClient",
);

export namespace CmsManageEndpointClient {
  export type Interface = IEndpointClient;
}
