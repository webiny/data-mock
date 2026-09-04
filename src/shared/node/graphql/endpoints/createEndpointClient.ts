import type { HttpClient } from "~/shared/abstractions/HttpClient.js";
import type { IEndpointClient } from "./abstractions/EndpointClient.js";

export function createEndpointClient(
  httpClient: HttpClient.Interface,
  path: string,
): IEndpointClient {
  return {
    async post(baseUrl, body, headers) {
      return httpClient.post(`${baseUrl}${path}`, body, headers);
    },
  };
}
