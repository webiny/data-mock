import type { HttpClient } from "./abstractions/HttpClient.js";

class FetchHttpClientImpl implements HttpClient.Interface {
  public async post(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<HttpClient.Response> {
    return fetch(url, {
      method: "POST",
      headers,
      body,
    });
  }
}

export const FetchHttpClient = FetchHttpClientImpl;
