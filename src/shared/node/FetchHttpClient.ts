import { HttpClient } from "~/shared/abstractions/HttpClient.js";

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

export const FetchHttpClient = HttpClient.createImplementation({
  implementation: FetchHttpClientImpl,
  dependencies: [],
});
