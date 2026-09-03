import { createAbstraction } from "@webiny/stdlib";

export interface IHttpResponse {
  readonly status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export interface IHttpClient {
  post(url: string, body: string, headers: Record<string, string>): Promise<IHttpResponse>;
}

export const HttpClient = createAbstraction<IHttpClient>("Shared/HttpClient");

export namespace HttpClient {
  export type Interface = IHttpClient;
  export type Response = IHttpResponse;
}
