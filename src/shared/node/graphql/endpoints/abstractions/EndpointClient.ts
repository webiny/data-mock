import type { HttpClient } from "~/shared/abstractions/HttpClient.js";

export interface IEndpointClient {
  post(
    baseUrl: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<HttpClient.Response>;
}
